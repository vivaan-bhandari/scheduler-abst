"""
Custom middleware for handling Railway health checks and other deployment-specific needs.
"""

from django.http import HttpResponse
from django.conf import settings


class RailwayHealthCheckMiddleware:
    """
    Middleware to handle Railway health check requests by bypassing
    host validation for health check endpoints.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Check if this is a Railway health check request
        host = request.META.get('HTTP_HOST', '')
        path = request.path
        
        # Log the request for debugging
        print(f"RailwayHealthCheckMiddleware: {request.method} {path} from {host}")
        
        # Check if this is a Railway health check request
        if (path == '/' and 
            (host.startswith('healthcheck.railway.app') or 
             host.startswith('healthcheck.') or
             'healthcheck' in host)):
            # Return a simple OK response for Railway health checks
            print(f"RailwayHealthCheckMiddleware: Returning OK for health check from {host}")
            return HttpResponse('OK', content_type='text/plain', status=200)
        
        # For all other requests, continue with normal processing
        return self.get_response(request)
