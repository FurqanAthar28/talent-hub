from django.contrib import admin
from .models import Connection, ConnectionRequest

admin.site.register(Connection)
admin.site.register(ConnectionRequest)