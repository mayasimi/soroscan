"""
Custom error handlers that return JSON responses instead of HTML.
"""
from django.http import JsonResponse


def custom_404(request, exception=None):
    """
    Handle 404 errors by returning JSON response.
    """
    return JsonResponse(
        {
            'error': 'Not found',
            'status': 404,
            'message': 'The requested resource was not found.',
            'request_id': getattr(request, 'request_id', None),
        },
        status=404,
        content_type='application/json',
    )


def custom_500(request):
    """
    Handle 500 errors by returning JSON response.
    """
    return JsonResponse(
        {
            'error': 'Internal server error',
            'status': 500,
            'message': 'An unexpected error occurred on the server.',
            'request_id': getattr(request, 'request_id', None),
        },
        status=500,
        content_type='application/json',
    )
