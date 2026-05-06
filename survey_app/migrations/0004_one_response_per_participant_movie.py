from django.db import migrations, models
from django.db.models import Count


def dedupe_movie_review_responses(apps, schema_editor):
    MovieReviewResponse = apps.get_model("survey_app", "MovieReviewResponse")

    duplicates = (
        MovieReviewResponse.objects.values("participant_id", "movie_id")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )

    for item in duplicates:
        rows = (
            MovieReviewResponse.objects.filter(
                participant_id=item["participant_id"],
                movie_id=item["movie_id"],
            )
            .order_by("-created_at", "-id")
        )
        keep = rows.first()
        if keep is None:
            continue
        rows.exclude(id=keep.id).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("survey_app", "0003_moviereviewresponse"),
    ]

    operations = [
        migrations.RunPython(dedupe_movie_review_responses, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="moviereviewresponse",
            constraint=models.UniqueConstraint(
                fields=("participant", "movie"),
                name="unique_movie_response_per_participant",
            ),
        ),
    ]
