#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HanoiHeatSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHanoiHeatChangedSignature, float, Heat, int32, Stars);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiViolationSignature, FName, RuleId, bool, bNoticed, int64, FineVnd);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiPulledOverSignature, int64, FinesPaidVnd);

/**
 * CSGT (traffic police) attention: the non-violent replacement for a wanted level.
 * Violations (collection "traffic_rules") add heat 0-5 and fines; heat decays once the player has
 * been out of police sight for Settings.HeatDecayDelaySeconds. Camera-enforced rules caught by a
 * camera issue a fine (phạt nguội) without a chase. Being pulled over pays the fines.
 * Police AI calls SetSeenByPolice; vehicle/traffic code calls ReportViolation.
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiHeatSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;

	/**
	 * A traffic rule was broken. bInCar picks the car fine; bSeenByPolice forces notice;
	 * bInCameraZone triggers camera_enforced rules. Returns true if the violation was noticed.
	 */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Heat")
	bool ReportViolation(FName RuleId, bool bInCar, bool bSeenByPolice, bool bInCameraZone);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Heat")
	void AddHeat(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Heat")
	void SetSeenByPolice(bool bInSeen);

	/** Police stopped the player: pay what can be paid, clear heat. Returns the amount paid. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Heat")
	int64 PulledOver();

	UFUNCTION(BlueprintPure, Category = "Hanoi|Heat")
	float GetHeat() const { return Heat; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Heat")
	int32 GetStars() const { return FMath::Clamp(FMath::CeilToInt(Heat), 0, 5); }

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Heat")
	FHanoiHeatChangedSignature OnHeatChanged;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Heat")
	FHanoiViolationSignature OnViolation;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Heat")
	FHanoiPulledOverSignature OnPulledOver;

protected:
	virtual bool DoesSupportWorldType(const EWorldType::Type WorldType) const override;

private:
	void SetHeat(float NewHeat);
	void AddFine(int64 FineVnd, int32 LicencePoints);

	float Heat = 0.f;
	bool bSeen = false;
	float SecondsUnseen = 0.f;
};
