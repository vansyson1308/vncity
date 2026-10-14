#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "HanoiSaveGame.generated.h"

/** Persistent player progress. Owned by UHanoiMissionSubsystem, saved to Settings.SaveSlot. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiPlayerState
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TSet<FName> CompletedMissions;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TSet<FName> Flags;

	/** Faction / district / character id -> reputation. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TMap<FName, int32> Reputation;

	/** Skill id (characters skills / skills.json) -> level 0-100. Seeded from the protagonist's starting skills, trained by activities (skills_trained) and random event choices; read by conditions (min_skills) and tier unlocks (skills.json). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TMap<FName, int32> Skills;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	int64 MoneyVnd = 0;

	/** Item id -> count. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TMap<FName, int32> Inventory;

	/** Unlocked refs as "collection:id". */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TSet<FName> Unlocked;

	/** Current protagonist character id. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	FName Protagonist;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	int32 LicencePoints = 12;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	int64 UnpaidFinesVnd = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	FDateTime GameTime;

	/** Hanoi game time of the last fine (mission apply_fine or a noticed violation); zero = none yet. Drives the clean-record flag. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	FDateTime LastFineGameTime;

	/** Random event id -> times it fired this playthrough (spawn.max_per_playthrough). UHanoiRandomEventSubsystem. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TMap<FName, int32> RandomEventCounts;

	/** Random event id -> game time it last fired (spawn.cooldown_days). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TMap<FName, FDateTime> RandomEventLast;

	/** Collectible ids found (collectibles.json). UHanoiCollectibleSubsystem. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TSet<FName> Collected;

	/** Cassette numbers 1-24 the player can play. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	TSet<int32> Tapes;

	/** flood_layers id running (a mission step's params.flood_layer), None = no flood. UHanoiFloodSubsystem. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	FName ActiveFloodLayer;

	/** Game time the running flood layer started (its t = 0). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, SaveGame, Category = "Hanoi")
	FDateTime FloodLayerStart;
};

UCLASS()
class HANOICITYRUNTIME_API UHanoiSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY(SaveGame)
	FHanoiPlayerState State;

	UPROPERTY(SaveGame)
	FName ActiveMission;

	UPROPERTY(SaveGame)
	FName ActiveStep;
};
