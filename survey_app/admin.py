from django.contrib import admin

from .models import (
    Movie,
    MovieReviewResponse,
    MovieSelection,
    ParticipantSession,
    Review,
    ScreenClip,
    WebcamClip,
)

admin.site.register(ParticipantSession)
admin.site.register(Movie)
admin.site.register(Review)
admin.site.register(MovieSelection)
admin.site.register(WebcamClip)
admin.site.register(ScreenClip)
admin.site.register(MovieReviewResponse)
