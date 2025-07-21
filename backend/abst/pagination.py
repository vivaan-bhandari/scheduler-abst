from rest_framework.pagination import PageNumberPagination
from django.conf import settings

class HTTPSPageNumberPagination(PageNumberPagination):
    """Custom pagination that forces HTTPS URLs"""
    
    def get_next_link(self):
        if not self.page.has_next():
            return None
        url = self.request.build_absolute_uri(self.page.next_page_number())
        # Force HTTPS
        if settings.USE_HTTPS and not settings.DEBUG:
            url = url.replace('http://', 'https://')
        return url

    def get_previous_link(self):
        if not self.page.has_previous():
            return None
        url = self.request.build_absolute_uri(self.page.previous_page_number())
        # Force HTTPS
        if settings.USE_HTTPS and not settings.DEBUG:
            url = url.replace('http://', 'https://')
        return url 