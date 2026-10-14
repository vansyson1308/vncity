#include "HanoiHeatSubsystem.h"
#include "HanoiCitySettings.h"
#include "HanoiContentSubsystem.h"
#include "HanoiMissionSubsystem.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

const FName UHanoiHeatSubsystem::PermanentHeatCapFlag(TEXT("giam_chu_y_vinh_vien_1"));

TStatId UHanoiHeatSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UHanoiHeatSubsystem, STATGROUP_Tickables);
}

bool UHanoiHeatSubsystem::DoesSupportWorldType(const EWorldType::Type WorldType) const
{
	return WorldType == EWorldType::Game || WorldType == EWorldType::PIE;
}

void UHanoiHeatSubsystem::Tick(float DeltaTime)
{
	if (bSeen || Heat <= 0.f)
	{
		SecondsUnseen = 0.f;
		return;
	}
	SecondsUnseen += DeltaTime;
	const UHanoiCitySettings* S = UHanoiCitySettings::Get();
	if (SecondsUnseen > S->HeatDecayDelaySeconds)
	{
		SetHeat(Heat - S->HeatDecayPerSecond * DeltaTime);
	}
}

void UHanoiHeatSubsystem::SetHeat(float NewHeat)
{
	const int32 OldStars = GetStars();
	const float Old = Heat;
	float MaxHeat = UHanoiCitySettings::Get()->MaxHeat;
	// Content flag giam_chu_y_vinh_vien_1 (reward of s12): the cap is one star lower for good (docs/gdd/02-he-thong.md §8).
	const UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr;
	if (const UHanoiMissionSubsystem* Missions = GI ? GI->GetSubsystem<UHanoiMissionSubsystem>() : nullptr)
	{
		if (Missions->GetPlayerStateRef().Flags.Contains(PermanentHeatCapFlag))
		{
			MaxHeat = FMath::Max(0.f, MaxHeat - 1.f);
		}
	}
	Heat = FMath::Clamp(NewHeat, 0.f, MaxHeat);
	if (GetStars() != OldStars || (Old > 0.f && Heat <= 0.f))
	{
		OnHeatChanged.Broadcast(Heat, GetStars());
	}
}

void UHanoiHeatSubsystem::AddHeat(float Amount)
{
	SecondsUnseen = 0.f;
	SetHeat(Heat + Amount);
}

void UHanoiHeatSubsystem::SetSeenByPolice(bool bInSeen)
{
	bSeen = bInSeen;
	if (bSeen)
	{
		SecondsUnseen = 0.f;
	}
}

void UHanoiHeatSubsystem::AddFine(int64 FineVnd, int32 LicencePoints)
{
	UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr;
	if (UHanoiMissionSubsystem* Missions = GI ? GI->GetSubsystem<UHanoiMissionSubsystem>() : nullptr)
	{
		FHanoiPlayerState& State = Missions->MutableState();
		State.UnpaidFinesVnd += FineVnd;
		State.LicencePoints = FMath::Max(0, State.LicencePoints - LicencePoints);
		Missions->RecordFine();  // also notifies
	}
}

int64 UHanoiHeatSubsystem::ApplyRuleFine(FName RuleId, bool bInCar)
{
	UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr;
	const UHanoiContentSubsystem* Content = GI ? GI->GetSubsystem<UHanoiContentSubsystem>() : nullptr;
	const FHanoiTrafficRuleRow* Rule = Content ? Content->Find<FHanoiTrafficRuleRow>(TEXT("traffic_rules"), RuleId) : nullptr;
	if (!Rule)
	{
		UE_LOG(LogHanoi, Warning, TEXT("Unknown traffic rule %s"), *RuleId.ToString());
		return 0;
	}
	const int64 Fine = bInCar ? Rule->FineVnd.Car : Rule->FineVnd.Motorbike;
	AddFine(Fine, Rule->LicencePoints);
	return Fine;
}

bool UHanoiHeatSubsystem::ReportViolation(FName RuleId, bool bInCar, bool bSeenByPolice, bool bInCameraZone)
{
	UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr;
	const UHanoiContentSubsystem* Content = GI ? GI->GetSubsystem<UHanoiContentSubsystem>() : nullptr;
	const FHanoiTrafficRuleRow* Rule = Content ? Content->Find<FHanoiTrafficRuleRow>(TEXT("traffic_rules"), RuleId) : nullptr;
	if (!Rule)
	{
		UE_LOG(LogHanoi, Warning, TEXT("Unknown traffic rule %s"), *RuleId.ToString());
		return false;
	}
	const int64 Fine = bInCar ? Rule->FineVnd.Car : Rule->FineVnd.Motorbike;
	bool bNoticed = false;
	if (bSeenByPolice || FMath::FRand() < Rule->Detection.BaseNoticeChance)
	{
		bNoticed = true;
		AddHeat(float(Rule->Heat));
		AddFine(Fine, Rule->LicencePoints);
	}
	else if (Rule->Detection.bCameraEnforced && bInCameraZone)
	{
		bNoticed = true;  // camera fine arrives later; no chase
		AddFine(Fine, Rule->LicencePoints);
	}
	OnViolation.Broadcast(RuleId, bNoticed, bNoticed ? Fine : 0);
	return bNoticed;
}

int64 UHanoiHeatSubsystem::PulledOver()
{
	int64 Paid = 0;
	UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr;
	if (UHanoiMissionSubsystem* Missions = GI ? GI->GetSubsystem<UHanoiMissionSubsystem>() : nullptr)
	{
		FHanoiPlayerState& State = Missions->MutableState();
		Paid = FMath::Min(State.MoneyVnd, State.UnpaidFinesVnd);
		State.MoneyVnd -= Paid;
		State.UnpaidFinesVnd -= Paid;
		Missions->NotifyStateChanged();
	}
	SetHeat(0.f);
	OnPulledOver.Broadcast(Paid);
	return Paid;
}
