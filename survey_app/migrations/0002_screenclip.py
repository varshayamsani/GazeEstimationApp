import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("survey_app", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ScreenClip",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("clip", models.FileField(upload_to="screen_clips/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "participant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="screen_clips",
                        to="survey_app.participantsession",
                    ),
                ),
            ],
        ),
    ]
