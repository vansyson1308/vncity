#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HanoiPointSetActor.generated.h"

class UHierarchicalInstancedStaticMeshComponent;
class UStaticMesh;

/**
 * One instanced mesh family (Set/Kind) for one pipeline tile, spawned by import_pcg_points.py
 * from out/<city>/pcg/<set>.csv + Config/asset_map.json. One actor per tile keeps World
 * Partition streaming granular. Later, PCG graphs can replace these (same DataTables).
 */
UCLASS()
class HANOICITYRUNTIME_API AHanoiPointSetActor : public AActor
{
	GENERATED_BODY()

public:
	AHanoiPointSetActor();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Hanoi|Points")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> Instances;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Points")
	FName Set;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Points")
	FName Kind;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hanoi|Points")
	FName Tile;

	/** Replaces all instances. Transforms are relative to this actor. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Points")
	void SetInstances(UStaticMesh* Mesh, const TArray<FTransform>& LocalTransforms, float CullDistanceM);
};
