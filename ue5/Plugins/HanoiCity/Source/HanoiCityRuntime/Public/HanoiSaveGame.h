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
