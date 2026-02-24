from django.contrib import admin

from .models import Network


@admin.register(Network)
class NetworkAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "rpc_url",
        "horizon_url",
        "is_active",
        "created_at",
    ]
    list_filter = ["is_active", "created_at"]
    search_fields = ["name", "rpc_url", "horizon_url"]
    ordering = ["name"]

