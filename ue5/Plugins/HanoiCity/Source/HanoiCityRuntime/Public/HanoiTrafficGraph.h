#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HanoiTrafficGraph.generated.h"

USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiTrafficEdge
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") int32 Id = 0;
	/** Node indices (not pipeline ids). */
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") int32 From = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") int32 To = 0;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") FString RoadId;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") FString Name;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") FName RoadClass;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") bool bOneway = false;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") bool bMotorbikeOnly = false;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") int32 Lanes = 1;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") float WidthM = 0.f;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") float SpeedKmh = 30.f;
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") float LengthM = 0.f;
	/** UE world points (cm), From -> To. */
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Traffic") TArray<FVector> Polyline;
};

/**
 * Loads out/<city>/traffic/graph.json (copied to Content/Data/City/traffic/graph.json by setup)
 * and answers A* route queries for vehicles and NPCs. Good for missions, GPS and a few dozen
 * agents; production ambient traffic should move to Mass + ZoneGraph (lanes built from the same
 * file), see docs/05-tich-hop-ue5.md.
 */
UCLASS()
class HANOICITYRUNTIME_API AHanoiTrafficGraph : public AActor
{
	GENERATED_BODY()

public:
	AHanoiTrafficGraph();

	/** Relative to the project Content dir; empty = Settings.TrafficGraphFile. Absolute paths also work. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Traffic")
	FString GraphFile;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Traffic")
	bool bLoadOnBeginPlay = true;

	UFUNCTION(BlueprintCallable, CallInEditor, Category = "Hanoi|Traffic")
	bool LoadGraph();

	/** Index of the closest node within MaxDistanceCm (2D), or -1. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Traffic")
	int32 FindNearestNode(const FVector& WorldLocation, float MaxDistanceCm = 50000.f) const;

	/**
	 * Fastest route (time = length / speed). Cars skip motorbike_only edges and respect oneway;
	 * motorbikes respect oneway too (set bIgnoreOneway for pedestrians).
	 */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Traffic")
	bool FindPath(const FVector& Start, const FVector& End, bool bIsCar, bool bIgnoreOneway, TArray<FVector>& OutPoints, TArray<int32>& OutEdges) const;

	UFUNCTION(BlueprintCallable, CallInEditor, Category = "Hanoi|Traffic")
	void DrawDebugGraph() const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Traffic")
	int32 NumNodes() const { return NodeLocations.Num(); }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Traffic")
	FHanoiTrafficEdge GetEdge(int32 Index) const { return Edges.IsValidIndex(Index) ? Edges[Index] : FHanoiTrafficEdge(); }

protected:
	virtual void BeginPlay() override;

private:
	struct FLink
	{
		int32 Edge;
		bool bReverse;
	};

	TArray<FVector> NodeLocations;
	TArray<bool> NodeSignals;
	TArray<FHanoiTrafficEdge> Edges;
	TArray<TArray<FLink>> Adjacency;
	TMap<FIntPoint, TArray<int32>> Grid;
	float MaxSpeedMps = 1.f;

	static constexpr float GridCellCm = 10000.f;
	FIntPoint CellOf(const FVector& P) const { return FIntPoint(FMath::FloorToInt(P.X / GridCellCm), FMath::FloorToInt(P.Y / GridCellCm)); }
};
