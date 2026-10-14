#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiCollectibleSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiCollectedSignature, const FHanoiCollectiblesRow&, Item);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiTapeUnlockedSignature, int32, Tape);

/**
 * The second map (collection collectibles, docs/gdd/02 §11), the C++ twin of the Unity core's
 * CollectibleSystem: 120 old photos to re-shoot, 40 ration coupons to find, 60 old signs to
 * photograph, each at a real coordinate. A photo counts only when the shot matches the old frame
 * (Settings.PhotoMatchThreshold) inside the photo's light hours. Tapes: a photo with unlocks_tape
 * opens that cassette; Tape22Photos / Tape23Photos photos open tapes 22 / 23; tape 24 opens with
 * Tape24Photos photos once chapter Tape24Chapter is reached, or by story (Tape24Flag). Coupons are
 * hidden near (not at) their coordinate at a spot stable per id (FNV-1a of the id, the same hash
 * as the Unity core). Collected ids and tapes are saved in FHanoiPlayerState (Collected, Tapes).
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiCollectibleSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	/** Where the player must be (world, cm): the coordinate, or for coupons the hiding spot near it. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Collectibles")
	FVector GetSpotWorld(FName Id) const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Collectibles")
	bool CanCollect(FName Id, FString& OutReason) const;

	/** Collect at the pawn's position. MatchScore: photos only (0-1); coupons and signs pass 1. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Collectibles")
	bool Collect(FName Id, float MatchScore = 1.f);

	/** Tapes that open by count or by story; also runs after every mission end. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Collectibles")
	void CheckTapes();

	UFUNCTION(BlueprintPure, Category = "Hanoi|Collectibles")
	int32 CountCollected(EHanoiCollectiblesSet Set) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Collectibles")
	int32 CountTotal(EHanoiCollectiblesSet Set) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Collectibles")
	bool IsTapeUnlocked(int32 Tape) const;

	/** Nearest uncollected item of a set to the pawn (phone map). None when there is none. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Collectibles")
	FName NearestUncollected(EHanoiCollectiblesSet Set) const;

	/** Uncollected items within RadiusM of the pawn (spawn pickups / photo prompts). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Collectibles")
	TArray<FName> Nearby(float RadiusM) const;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Collectibles")
	FHanoiCollectedSignature OnCollected;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Collectibles")
	FHanoiTapeUnlockedSignature OnTapeUnlocked;

	/** FNV-1a 32-bit of an id, as the Unity core hashes it (UTF-16 code units). */
	static uint32 HashId(const FString& Id);

private:
	UFUNCTION()
	void HandleMissionEnded(FName MissionId, bool bSuccess, FName Reason);

	const FHanoiCollectiblesRow* Get(FName Id) const;
	FVector SpotWorld(const FHanoiCollectiblesRow& Item) const;
	bool PawnLocation(FVector& OutWorld) const;
	void UnlockTape(int32 Tape);
	class UHanoiMissionSubsystem* Missions() const;
};
