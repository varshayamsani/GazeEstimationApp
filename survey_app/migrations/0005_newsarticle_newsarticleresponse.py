from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("survey_app", "0004_one_response_per_participant_movie"),
    ]

    operations = [
        migrations.CreateModel(
            name="NewsArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(unique=True)),
                ("headline", models.CharField(max_length=255)),
                ("source", models.CharField(max_length=120)),
                ("summary", models.TextField()),
                ("body", models.TextField()),
                ("is_fake", models.BooleanField(default=False)),
            ],
            options={
                "ordering": ["headline"],
            },
        ),
        migrations.CreateModel(
            name="NewsArticleResponse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("classification_choice", models.CharField(max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("article", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="responses", to="survey_app.newsarticle")),
                ("participant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="news_article_responses", to="survey_app.participantsession")),
            ],
        ),
        migrations.AddConstraint(
            model_name="newsarticleresponse",
            constraint=models.UniqueConstraint(fields=("participant", "article"), name="unique_news_response_per_participant"),
        ),
    ]
