#include "HanoiWeather.h"
#include "HanoiCitySettings.h"
#include "HanoiContentSubsystem.h"
#include "Dom/JsonObject.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Math/RandomStream.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace HanoiClimate
{
	// Approximate Hanoi (Lang station) normals per month, Jan..Dec.
	constexpr float MeanTempC[12] = {16.4f, 17.2f, 20.0f, 23.9f, 27.4f, 28.9f, 29.2f, 28.6f, 27.5f, 24.9f, 21.5f, 18.2f};
	constexpr float DailyRangeC[12] = {5.f, 4.5f, 4.5f, 5.5f, 6.5f, 6.f, 6.f, 5.5f, 5.5f, 6.f, 6.f, 6.f};
	constexpr float RainDayShare[12] = {0.28f, 0.38f, 0.48f, 0.42f, 0.45f, 0.50f, 0.53f, 0.55f, 0.45f, 0.30f, 0.22f, 0.18f};
	constexpr float DrizzleShareOfRain[12] = {0.7f, 0.8f, 0.8f, 0.4f, 0.1f, 0.05f, 0.05f, 0.05f, 0.1f, 0.2f, 0.4f, 0.6f};
	constexpr float StormShareOfRain[12] = {0.f, 0.f, 0.02f, 0.1f, 0.25f, 0.3f, 0.35f, 0.35f, 0.25f, 0.1f, 0.02f, 0.f};
	constexpr float NomShare[12] = {0.05f, 0.35f, 0.4f, 0.15f, 0.f, 0.f, 0.f, 0.f, 0.f, 0.f, 0.f, 0.02f};
	constexpr float Humidity[12] = {0.80f, 0.84f, 0.88f, 0.87f, 0.82f, 0.81f, 0.82f, 0.85f, 0.83f, 0.79f, 0.77f, 0.77f};
}

FHanoiWeatherState UHanoiClimatologyWeather::Sample(const FDateTime& Local)
{
	using namespace HanoiClimate;
	const int32 M = Local.GetMonth() - 1;
	FRandomStream Day(Local.GetYear() * 1000 + Local.GetDayOfYear());
	const float Hour = Local.GetHour() + Local.GetMinute() / 60.f;

	FHanoiWeatherState W;
	W.Source = TEXT("climatology");
	W.TimeUtc = Local - FTimespan::FromHours(7);
	// Day-level draws (same all day), then a diurnal temperature curve peaking ~14:00.
	const float DayOffset = Day.FRandRange(-2.5f, 2.5f);
	const bool bRainDay = Day.FRand() < RainDayShare[M];
	const float RainKind = Day.FRand();
	const int32 RainStart = Day.RandRange(0, 23);
	const int32 RainHours = Day.RandRange(1, 6);
	W.bNom = Day.FRand() < NomShare[M];
	W.TemperatureC = MeanTempC[M] + DayOffset + 0.5f * DailyRangeC[M] * FMath::Cos((Hour - 14.f) / 24.f * 2.f * UE_PI);
	W.Humidity = FMath::Clamp(Humidity[M] + (W.bNom ? 0.12f : 0.f) - 0.1f * FMath::Cos((Hour - 14.f) / 24.f * 2.f * UE_PI), 0.f, 1.f);
	W.WindKmh = Day.FRandRange(4.f, 14.f);
	W.CloudCover = bRainDay ? 0.9f : Day.FRandRange(0.1f, 0.7f);

	const bool bRainingNow = bRainDay && ((int32(Hour) - RainStart + 24) % 24) < RainHours;
	if (bRainingNow)
	{
		if (RainKind < DrizzleShareOfRain[M]) { W.Condition = EHanoiWeather::Drizzle; W.PrecipMmH = 0.3f; }
		else if (RainKind > 1.f - StormShareOfRain[M]) { W.Condition = EHanoiWeather::Storm; W.PrecipMmH = 20.f; W.WindKmh *= 3.f; }
		else { W.Condition = EHanoiWeather::Rain; W.PrecipMmH = 4.f; }
	}
	else if ((M <= 2 || M == 11) && Hour >= 5.f && Hour < 9.f && Day.FRand() < 0.4f)
	{
		W.Condition = EHanoiWeather::Fog;
	}
	else if (W.TemperatureC >= 35.f)
	{
		W.Condition = EHanoiWeather::Hot;
	}
	else if (W.TemperatureC <= 13.f)
	{
		W.Condition = EHanoiWeather::Cold;
	}
	else
	{
		W.Condition = W.CloudCover > 0.6f ? EHanoiWeather::Cloudy : EHanoiWeather::Clear;
	}
	return W;
}

void UHanoiClimatologyWeather::RequestWeather(const FDateTime& HanoiLocalTime, TFunction<void(const FHanoiWeatherState&)> Done)
{
	Done(Sample(HanoiLocalTime));
}

bool UHanoiHttpWeather::ParseFeed(const FString& Json, FHanoiWeatherState& Out)
{
	TSharedPtr<FJsonObject> Obj;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Obj) || !Obj.IsValid())
	{
		return false;
	}
	FString Condition;
	if (!Obj->TryGetStringField(TEXT("condition"), Condition))
	{
		return false;
	}
	const int64 Value = UHanoiContentSubsystem::EnumValueFromContentString(StaticEnum<EHanoiWeather>(), Condition);
	if (Value <= 0)
	{
		return false;
	}
	Out.Condition = static_cast<EHanoiWeather>(Value);
	double Number = 0.0;
	if (Obj->TryGetNumberField(TEXT("temperature_c"), Number)) { Out.TemperatureC = float(Number); }
	if (Obj->TryGetNumberField(TEXT("humidity"), Number)) { Out.Humidity = float(Number); }
	if (Obj->TryGetNumberField(TEXT("precip_mm_h"), Number)) { Out.PrecipMmH = float(Number); }
	if (Obj->TryGetNumberField(TEXT("cloud_cover"), Number)) { Out.CloudCover = float(Number); }
	if (Obj->TryGetNumberField(TEXT("wind_kmh"), Number)) { Out.WindKmh = float(Number); }
	bool bNom = false;
	if (Obj->TryGetBoolField(TEXT("nom"), bNom)) { Out.bNom = bNom; }
	Obj->TryGetStringField(TEXT("source"), Out.Source);
	FString Time;
	if (Obj->TryGetStringField(TEXT("time_utc"), Time))
	{
		FDateTime::ParseIso8601(*Time, Out.TimeUtc);
	}
	return true;
}

void UHanoiHttpWeather::RequestWeather(const FDateTime& HanoiLocalTime, TFunction<void(const FHanoiWeatherState&)> Done)
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Endpoint);
	Request->SetVerb(TEXT("GET"));
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
	Request->OnProcessRequestComplete().BindLambda(
		[HanoiLocalTime, Done = MoveTemp(Done), Url = Endpoint](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnected)
		{
			FHanoiWeatherState State;
			if (bConnected && Response.IsValid() && Response->GetResponseCode() == 200 && ParseFeed(Response->GetContentAsString(), State))
			{
				Done(State);
				return;
			}
			UE_LOG(LogHanoi, Warning, TEXT("Weather feed %s unavailable; using climatology"), *Url);
			Done(UHanoiClimatologyWeather::Sample(HanoiLocalTime));
		});
	Request->ProcessRequest();
}
