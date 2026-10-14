#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiWeather.generated.h"

/** Current weather. Mirrors the live/weather.py feed (GET /weather). */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiWeatherState
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	EHanoiWeather Condition = EHanoiWeather::Clear;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	float TemperatureC = 27.f;

	/** 0-1 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	float Humidity = 0.75f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	float PrecipMmH = 0.f;

	/** 0-1 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	float CloudCover = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	float WindKmh = 8.f;

	/** "Nồm ẩm" damp spell: condensation, wet floors and walls (late winter / spring). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	bool bNom = false;

	/** "open-meteo", "climatology", "manual"... */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	FString Source;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Weather")
	FDateTime TimeUtc;
};

UINTERFACE(MinimalAPI, meta = (CannotImplementInterfaceInBlueprint))
class UHanoiWeatherProvider : public UInterface
{
	GENERATED_BODY()
};

/**
 * Something that can produce weather for a moment in Hanoi local time. Implementations call
 * Done on the game thread, possibly later (HTTP). Add new feeds by implementing this.
 */
class HANOICITYRUNTIME_API IHanoiWeatherProvider
{
	GENERATED_BODY()

public:
	virtual void RequestWeather(const FDateTime& HanoiLocalTime, TFunction<void(const FHanoiWeatherState&)> Done) = 0;
};

/** Baked monthly climate normals for Hanoi; deterministic per game day (seeded by date). */
UCLASS()
class HANOICITYRUNTIME_API UHanoiClimatologyWeather : public UObject, public IHanoiWeatherProvider
{
	GENERATED_BODY()

public:
	virtual void RequestWeather(const FDateTime& HanoiLocalTime, TFunction<void(const FHanoiWeatherState&)> Done) override;

	static FHanoiWeatherState Sample(const FDateTime& HanoiLocalTime);
};

/**
 * Live feed over HTTP: GET Endpoint returning
 * {"time_utc","local_hour","condition","temperature_c","humidity","precip_mm_h","cloud_cover",
 *  "wind_kmh","nom","source"} (live/weather.py). Falls back to climatology on any error.
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiHttpWeather : public UObject, public IHanoiWeatherProvider
{
	GENERATED_BODY()

public:
	UPROPERTY()
	FString Endpoint;

	virtual void RequestWeather(const FDateTime& HanoiLocalTime, TFunction<void(const FHanoiWeatherState&)> Done) override;

	/** Parses the feed JSON; false if it is not an object with a known condition. */
	static bool ParseFeed(const FString& Json, FHanoiWeatherState& Out);
};
