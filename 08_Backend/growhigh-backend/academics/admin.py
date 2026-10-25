from django.contrib import admin

from .models import Branch, Guide, Material, Regulation, Subject, Topic

admin.site.register(Branch, list_display=("code", "name", "is_active"))
admin.site.register(Subject, list_display=("name", "branch", "is_active"), list_filter=("branch",))
admin.site.register(Topic, list_display=("name", "subject", "order_no", "is_active"), list_filter=("subject",))
admin.site.register(Regulation, list_display=("code", "name", "is_active"))
admin.site.register(Material, list_display=("title", "kind", "topic", "is_active"))
admin.site.register(Guide, list_display=("title", "area", "section", "kind", "is_active"), list_filter=("area", "section"))
