"""
Middleware for GraphQL subscription rate limiting.
"""
import logging
from collections import defaultdict
from typing import Any


logger = logging.getLogger(__name__)


class SubscriptionRateLimitMiddleware:
    """
    Middleware to limit concurrent subscriptions per IP address.
    
    Limits each IP to a maximum of 5 concurrent subscriptions.
    """
    
    MAX_SUBSCRIPTIONS_PER_IP = 5
    
    # Class-level tracking of active subscriptions by IP
    _active_subscriptions: dict[str, int] = defaultdict(int)
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        # Only apply to websocket connections for GraphQL
        if scope["type"] != "websocket":
            return await self.app(scope, receive, send)
        
        # Get client IP from scope
        client_ip = self._get_client_ip(scope)
        
        # Check if IP has too many active subscriptions
        if self._active_subscriptions[client_ip] >= self.MAX_SUBSCRIPTIONS_PER_IP:
            logger.warning(
                f"Rate limit exceeded for IP {client_ip}: "
                f"{self._active_subscriptions[client_ip]} active subscriptions"
            )
            # Close the connection immediately
            await send({
                "type": "websocket.close",
                "code": 4429,  # Custom close code for rate limit
            })
            return
        
        # Increment counter
        self._active_subscriptions[client_ip] += 1
        logger.info(
            f"Subscription opened for IP {client_ip}. "
            f"Active: {self._active_subscriptions[client_ip]}/{self.MAX_SUBSCRIPTIONS_PER_IP}"
        )
        
        try:
            # Process the connection
            await self.app(scope, receive, send)
        finally:
            # Decrement counter when connection closes
            self._active_subscriptions[client_ip] -= 1
            if self._active_subscriptions[client_ip] <= 0:
                del self._active_subscriptions[client_ip]
            logger.info(
                f"Subscription closed for IP {client_ip}. "
                f"Remaining: {self._active_subscriptions.get(client_ip, 0)}"
            )
    
    @staticmethod
    def _get_client_ip(scope: dict[str, Any]) -> str:
        """
        Extract client IP from ASGI scope.
        
        Checks X-Forwarded-For header first (for proxies), then falls back to client address.
        """
        headers = dict(scope.get("headers", []))
        
        # Check X-Forwarded-For header
        forwarded_for = headers.get(b"x-forwarded-for", b"").decode("utf-8")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        # Fall back to direct client address
        client = scope.get("client")
        if client:
            return client[0]
        
        return "unknown"
