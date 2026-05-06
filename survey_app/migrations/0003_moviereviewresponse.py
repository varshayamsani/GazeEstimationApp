# Generated manually for MovieReviewResponse
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("survey_app", "0002_screenclip"),
    ]

    operations = [
        migrations.CreateModel(
            name="MovieReviewResponse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("review_text", models.TextField(blank=True)),
                ("sentiment_choice", models.CharField(max_length=12)),
                ("rating_choice", models.DecimalField(decimal_places=1, max_digits=2)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "movie",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="responses",
                        to="survey_app.movie",
                    ),
                ),
                (
                    "participant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="movie_review_responses",
                        to="survey_app.participantsession",
                    ),
                ),
            ],
        ),
    ]
