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

	/** Game days without a fine before the flag ho_so_sach_90_ngay is set (missions.requires.flags). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Heat", meta = (ClampMin = "1"))
	int32 CleanRecordDays = 90;

	/** Default arrival radius for go_to-like mission steps (params.radius_m overrides). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Missions")
	float MissionArriveRadiusM = 15.f;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Missions")
	FString SaveSlot = TEXT("HanoiSave");

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Missions")
	int64 StartingMoneyVnd = 500000;

	/** Levels a skill gains each time a job, minigame or random-event choice trains it (tuning; Unity HanoiRules.SkillGainPerTraining). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Skills", meta = (ClampMin = "0", ClampMax = "100"))
	int32 SkillGainPerTraining = 2;

	/** spawn.landmarks: the player must be this close to one of the landmarks. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Random events")
	float RandomEventLandmarkRadiusM = 150.f;

	/** Real seconds an event waits for the player when it has no duration_s (tuning). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Random events")
	float RandomEventDefaultDurationS = 90.f;

	/** GTA-style: nothing random spawns while a mission runs. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Random events")
	bool bRandomEventsDuringMissions = false;

	/** Distance at which a collectible can be taken / photographed. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	float CollectRadiusM = 30.f;

	/** "Chụp khớp trên 85%": an old photo counts from this match score (0-1). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles", meta = (ClampMin = "0", ClampMax = "1"))
	float PhotoMatchThreshold = 0.85f;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	int32 Tape22Photos = 60;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	int32 Tape23Photos = 90;

	/** Tape 24 (the 49 Hàng Chiếu answer): this many photos once chapter Tape24Chapter is reached... */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	int32 Tape24Photos = 30;

	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	int32 Tape24Chapter = 3;

	/** ...or by story: ông Thắng tells it in chapter 4 (docs/gdd/02 §11). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	FName Tape24Flag = TEXT("khoi_nghe_thang_ke_het");

	/** Coupons are hidden at most this far from their coordinate (a house on the street). */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Collectibles")
	float CouponHideRadiusM = 20.f;

	/** Flood layers (UHanoiFloodSubsystem): game minutes between updates of traffic, world events and the player. */
	UPROPERTY(config, EditAnywhere, BlueprintReadOnly, Category = "Flood")
	float FloodUpdateGameMinutes = 5.f;

	virtual FName GetCategoryName() const override { return TEXT("Game"); }

	static const UHanoiCitySettings* Get() { return GetDefault<UHanoiCitySettings>(); }
};
