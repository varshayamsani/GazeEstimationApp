from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("survey_app", "0007_networkdiagram_networkdiagramresponse"),
    ]

    operations = [
        migrations.AddField(
            model_name="networkdiagram",
            name="image_alt",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="networkdiagram",
            name="image_source_label",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="networkdiagram",
            name="image_source_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="networkdiagram",
            name="image_url",
            field=models.URLField(blank=True),
        ),
    ]
