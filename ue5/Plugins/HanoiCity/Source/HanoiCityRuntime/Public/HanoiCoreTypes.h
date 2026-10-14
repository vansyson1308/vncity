// Hand-written shared types used by the generated content rows (Generated/HanoiContentTypes.h).
// tools/codegen_ue.py knows the field layout of every struct here (CORE table); keep them in sync.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "HanoiCoreTypes.generated.h"

/** Localised text from content JSON ({"vi", "en"}). Vietnamese is the source language. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiText
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FString Vi;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FString En;

	/** English if requested and present, else Vietnamese. */
	const FString& Get(bool bEnglish) const { return (bEnglish && !En.IsEmpty()) ? En : Vi; }
	FText ToText(bool bEnglish) const { return FText::FromString(Get(bEnglish)); }
};

/** WGS84 point; convert with UHanoiGeoSubsystem. bIsSet is false when the content omitted it. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiGeo
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	double Lat = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	double Lon = 0.0;

	/** Height above the city origin height, metres. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	double AltM = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	bool bIsSet = false;
};

/** Reference '<collection>:<id>' to another content row. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiRef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FName Collection;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FName Id;

	FHanoiRef() = default;
	FHanoiRef(FName InCollection, FName InId) : Collection(InCollection), Id(InId) {}

	bool IsValid() const { return !Collection.IsNone() && !Id.IsNone(); }
	FString ToString() const { return FString::Printf(TEXT("%s:%s"), *Collection.ToString(), *Id.ToString()); }

	/** Parses "collection:id"; returns an invalid ref on malformed input. */
	static FHanoiRef Parse(const FString& Text)
	{
		FString Left, Right;
		return Text.Split(TEXT(":"), &Left, &Right) ? FHanoiRef(FName(*Left), FName(*Right)) : FHanoiRef();
	}

	bool operator==(const FHanoiRef& Other) const { return Collection == Other.Collection && Id == Other.Id; }
	bool operator!=(const FHanoiRef& Other) const { return !(*this == Other); }
	friend uint32 GetTypeHash(const FHanoiRef& Ref) { return HashCombine(GetTypeHash(Ref.Collection), GetTypeHash(Ref.Id)); }
};

/** Hours of day [From, To), 0-24; To < From wraps past midnight. Default 0-24 = always. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiHourRange
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	float From = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	float To = 24.f;

	bool Contains(float Hour) const
	{
		if (From <= To)
		{
			return Hour >= From && (Hour < To || To >= 24.f);
		}
		return Hour >= From || Hour < To;
	}
};

/** A content boolean whose absence means something (schema "x-ue": "optional_bool"), e.g. random_events
 *  spawn.on_vehicle: absent = riding or on foot. */
UENUM(BlueprintType)
enum class EHanoiOptionalBool : uint8
{
	Unset,
	False,
	True
};

UENUM(BlueprintType)
enum class EHanoiTargetKind : uint8
{
	Unset,
	Geo,
	Ref
};

/** Schema oneOf [geo, ref] (e.g. mission step target): a WGS84 point or a reference to a row. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiTarget
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	EHanoiTargetKind Kind = EHanoiTargetKind::Unset;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FHanoiGeo Geo;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FHanoiRef Ref;
};

/**
 * Schema oneOf [id, {outcome: id}] (mission step `next`): either one next step, or a branch
 * table keyed by outcome (choice key, minigame result...). Both empty = sequential/end.
 */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiNext
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	FName Step;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi")
	TMap<FName, FName> Branches;

	bool IsBranching() const { return Branches.Num() > 0; }
	bool IsEmpty() const { return Step.IsNone() && Branches.Num() == 0; }
};

/** One row of a pipeline point set (out/<city>/pcg/<set>.csv), imported as-is. ENU metres. */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiPcgPointRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") double X = 0.0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") double Y = 0.0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") double Z = 0.0;
	/** Degrees counter-clockwise from east. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") float Yaw = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") float Scale = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") FName Set;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") FName Kind;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") int32 Variant = 0;
	/** Stable per-row seed; pipeline values span uint32, hence int64. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") int64 Seed = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") FName Tile;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi") FString Ref;
};
