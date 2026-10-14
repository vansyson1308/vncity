#include "HanoiPointSetActor.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"

AHanoiPointSetActor::AHanoiPointSetActor()
{
	PrimaryActorTick.bCanEverTick = false;
	Instances = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("Instances"));
	Instances->SetMobility(EComponentMobility::Static);
	Instances->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	RootComponent = Instances;
}

void AHanoiPointSetActor::SetInstances(UStaticMesh* Mesh, const TArray<FTransform>& LocalTransforms, float CullDistanceM)
{
	Modify();
	Instances->Modify();
	Instances->ClearInstances();
	Instances->SetStaticMesh(Mesh);
	if (CullDistanceM > 0.f)
	{
		const int32 EndCm = FMath::RoundToInt(CullDistanceM * 100.f);
		Instances->SetCullDistances(EndCm * 3 / 4, EndCm);
	}
	Instances->AddInstances(LocalTransforms, false);
}
