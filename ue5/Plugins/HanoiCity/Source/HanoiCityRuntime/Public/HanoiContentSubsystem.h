#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Engine/DataTable.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiContentSubsystem.generated.h"

/**
 * Loads the content DataTables (<ContentTablePath>/DT_<collection>, created by
 * import_content.py from game/content) and resolves FHanoiRef lookups.
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiContentSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Reloads every table (e.g. after re-running import_content.py in PIE). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Content")
	void ReloadTables();

	UFUNCTION(BlueprintPure, Category = "Hanoi|Content")
	UDataTable* GetTable(FName Collection) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Content")
	bool HasRow(const FHanoiRef& Ref) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Content")
	static FHanoiRef MakeRef(const FString& RefText) { return FHanoiRef::Parse(RefText); }

	template <typename RowType>
	const RowType* Find(FName Collection, FName Id) const
	{
		const UDataTable* Table = GetTable(Collection);
		return Table ? Table->FindRow<RowType>(Id, TEXT("HanoiContent"), false) : nullptr;
	}

	template <typename RowType>
	const RowType* Find(const FHanoiRef& Ref) const { return Find<RowType>(Ref.Collection, Ref.Id); }

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Content")
	bool GetMission(FName Id, FHanoiMissionRow& OutRow) const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Content")
	bool GetDialogue(FName Id, FHanoiDialogueRow& OutRow) const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Content")
	bool GetCharacter(FName Id, FHanoiCharacterRow& OutRow) const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Content")
	bool GetTrafficRule(FName Id, FHanoiTrafficRuleRow& OutRow) const;

	/** WGS84 point of a ref: landmarks.location, businesses.location, characters.home, districts.center, factions.base. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Content")
	bool ResolveLocation(const FHanoiRef& Ref, FHanoiGeo& OutGeo) const;

	/** Content enum string ("race_legal") -> enum value, using the codegen identifier rule; -1 if unknown. */
	static int64 EnumValueFromContentString(const UEnum* Enum, const FString& Value);

private:
	UPROPERTY()
	TMap<FName, TObjectPtr<UDataTable>> Tables;
};
