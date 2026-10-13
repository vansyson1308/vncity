#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "HanoiCitySettings.generated.h"

HANOICITYRUNTIME_API DECLARE_LOG_CATEGORY_EXTERN(LogHanoi, Log, All);

UENUM(BlueprintType)
enum class EHanoiWeatherSourceKind : uint8
{
	/** Baked Hanoi monthly climate normals, deterministic per game day. */
	Climatology,
	/** HTTP JSON from WeatherEndpoint: the live/weather.py feed (python -m live.weather --serve 8765). */
	LiveHttp,
	/** Nothing polls; gameplay calls UHanoiTimeWeatherSubsystem::SetWeather. */
	Manual
};

/** Project Settings > Game > Hanoi City. Stored in Config/DefaultGame.ini. */
UCLASS(config = Game, defaultconfig, meta = (DisplayName = "Hanoi City"))
class HANOICITYRUNTIME_API UHanoiCitySettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	/** City origin (manifest.georeference); written by setup_project.py. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Georeference")
	double OriginLat = 21.031;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Georeference")
	double OriginLon = 105.85;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Georeference")
	double OriginHeightM = 0.0;

	/** Folder holding DT_<collection> DataTables created by import_content.py. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Content")
	FString ContentTablePath = TEXT("/Game/Hanoi/Data");

	/** traffic/graph.json copied by setup, relative to the project Content dir (staged as UFS). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Traffic")
	FString TrafficGraphFile = TEXT("Data/City/traffic/graph.json");

	/** Game seconds per real second (30 = a 48 minute day). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Time", meta = (ClampMin = "0"))
	float TimeScale = 30.f;

	/** Follow the real clock in Hanoi (UTC+7) instead of the scaled game clock. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Time")
	bool bSyncToRealHanoiTime = false;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Time", meta = (ClampMin = "0", ClampMax = "24"))
	float StartHour = 7.f;

	/** Rotate a directional light from the computed sun position. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Time")
	bool bDriveSun = true;

	/** Actor tag of the sun light; if no actor has it, the first directional light is used. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Time")
	FName SunLightTag = TEXT("HanoiSun");

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Weather")
	EHanoiWeatherSourceKind WeatherSource = EHanoiWeatherSourceKind::Climatology;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Weather")
	FString WeatherEndpoint = TEXT("http://127.0.0.1:8765/weather");

	/** Real seconds between live polls. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Weather", meta = (ClampMin = "30"))
	float WeatherPollSeconds = 900.f;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Heat")
	float MaxHeat = 5.f;

	/** Seconds out of police sight before heat starts to decay. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Heat")
	float HeatDecayDelaySeconds = 20.f;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Heat")
	float HeatDecayPerSecond = 0.05f;

	/** Default arrival radius for go_to-like mission steps (params.radius_m overrides). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Missions")
	float MissionArriveRadiusM = 15.f;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Missions")
	FString SaveSlot = TEXT("HanoiSave");

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Missions")
	int64 StartingMoneyVnd = 500000;

	virtual FName GetCategoryName() const override { return TEXT("Game"); }

	static const UHanoiCitySettings* Get() { return GetDefault<UHanoiCitySettings>(); }
};
