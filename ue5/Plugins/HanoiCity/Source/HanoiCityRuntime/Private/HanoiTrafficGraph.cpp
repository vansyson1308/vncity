#include "HanoiTrafficGraph.h"
#include "Algo/Reverse.h"
#include "HanoiCitySettings.h"
#include "HanoiGeoSubsystem.h"
#include "Components/SceneComponent.h"
#include "Dom/JsonObject.h"
#include "DrawDebugHelpers.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

AHanoiTrafficGraph::AHanoiTrafficGraph()
{
	PrimaryActorTick.bCanEverTick = false;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AHanoiTrafficGraph::BeginPlay()
{
	Super::BeginPlay();
	if (bLoadOnBeginPlay && NodeLocations.Num() == 0)
	{
		LoadGraph();
	}
}

bool AHanoiTrafficGraph::LoadGraph()
{
	FString Path = GraphFile.IsEmpty() ? UHanoiCitySettings::Get()->TrafficGraphFile : GraphFile;
	if (FPaths::IsRelative(Path))
	{
		Path = FPaths::ProjectContentDir() / Path;
	}
	FString Text;
	TSharedPtr<FJsonObject> Root;
	if (!FFileHelper::LoadFileToString(Text, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Root) || !Root.IsValid())
	{
		UE_LOG(LogHanoi, Error, TEXT("Traffic graph %s missing or invalid"), *Path);
		return false;
	}
	NodeLocations.Reset();
	NodeSignals.Reset();
	Edges.Reset();
	Adjacency.Reset();
	Grid.Reset();
	MaxSpeedMps = 1.f;

	TMap<int64, int32> IndexOfId;
	const TArray<TSharedPtr<FJsonValue>>* Nodes = nullptr;
	const TArray<TSharedPtr<FJsonValue>>* JsonEdges = nullptr;
	if (!Root->TryGetArrayField(TEXT("nodes"), Nodes) || !Root->TryGetArrayField(TEXT("edges"), JsonEdges))
	{
		UE_LOG(LogHanoi, Error, TEXT("Traffic graph %s: expected nodes and edges"), *Path);
		return false;
	}
	for (const TSharedPtr<FJsonValue>& V : *Nodes)
	{
		const TSharedPtr<FJsonObject> N = V->AsObject();
		double Z = 0.0;
		N->TryGetNumberField(TEXT("z"), Z);
		const FVector P = UHanoiGeoSubsystem::EnuToWorld(FVector(N->GetNumberField(TEXT("x")), N->GetNumberField(TEXT("y")), Z));
		bool bSignal = false;
		N->TryGetBoolField(TEXT("signal"), bSignal);
		const int32 Index = NodeLocations.Add(P);
		NodeSignals.Add(bSignal);
		IndexOfId.Add(int64(N->GetNumberField(TEXT("id"))), Index);
		Grid.FindOrAdd(CellOf(P)).Add(Index);
	}
	Adjacency.SetNum(NodeLocations.Num());

	for (const TSharedPtr<FJsonValue>& V : *JsonEdges)
	{
		const TSharedPtr<FJsonObject> J = V->AsObject();
		const int32* From = IndexOfId.Find(int64(J->GetNumberField(TEXT("from"))));
		const int32* To = IndexOfId.Find(int64(J->GetNumberField(TEXT("to"))));
		if (!From || !To)
		{
			continue;
		}
		FHanoiTrafficEdge E;
		E.Id = int32(J->GetNumberField(TEXT("id")));
		E.From = *From;
		E.To = *To;
		J->TryGetStringField(TEXT("road_id"), E.RoadId);
		J->TryGetStringField(TEXT("name"), E.Name);
		FString Class;
		J->TryGetStringField(TEXT("class"), Class);
		E.RoadClass = FName(*Class);
		J->TryGetBoolField(TEXT("oneway"), E.bOneway);
		J->TryGetBoolField(TEXT("motorbike_only"), E.bMotorbikeOnly);
		double Number = 0.0;
		if (J->TryGetNumberField(TEXT("lanes"), Number)) { E.Lanes = FMath::Max(1, int32(Number)); }
		if (J->TryGetNumberField(TEXT("width_m"), Number)) { E.WidthM = float(Number); }
		if (J->TryGetNumberField(TEXT("speed_kmh"), Number) && Number > 0.0) { E.SpeedKmh = float(Number); }
		if (J->TryGetNumberField(TEXT("length_m"), Number)) { E.LengthM = float(Number); }

		const TArray<TSharedPtr<FJsonValue>>* Poly = nullptr;
		const FVector& A = NodeLocations[E.From];
		const FVector& B = NodeLocations[E.To];
		if (J->TryGetArrayField(TEXT("polyline"), Poly) && Poly->Num() >= 2)
		{
			for (int32 I = 0; I < Poly->Num(); ++I)
			{
				const TArray<TSharedPtr<FJsonValue>>& XY = (*Poly)[I]->AsArray();
				const double Alpha = double(I) / double(Poly->Num() - 1);
				FVector P = UHanoiGeoSubsystem::EnuToWorld(FVector(XY[0]->AsNumber(), XY[1]->AsNumber(), 0.0));
				P.Z = FMath::Lerp(A.Z, B.Z, Alpha);
				if (E.Polyline.Num() == 0 || !E.Polyline.Last().Equals(P, 1.0))
				{
					E.Polyline.Add(P);
				}
			}
		}
		if (E.Polyline.Num() < 2)
		{
			E.Polyline = {A, B};
		}
		if (E.LengthM <= 0.f)
		{
			E.LengthM = float(FVector::Dist(A, B) / 100.0);
		}
		MaxSpeedMps = FMath::Max(MaxSpeedMps, E.SpeedKmh / 3.6f);
		const int32 Index = Edges.Add(MoveTemp(E));
		Adjacency[Edges[Index].From].Add({Index, false});
		Adjacency[Edges[Index].To].Add({Index, true});
	}
	UE_LOG(LogHanoi, Log, TEXT("Traffic graph: %d nodes, %d edges from %s"), NodeLocations.Num(), Edges.Num(), *Path);
	return true;
}

int32 AHanoiTrafficGraph::FindNearestNode(const FVector& WorldLocation, float MaxDistanceCm) const
{
	const FIntPoint C = CellOf(WorldLocation);
	const int32 Reach = FMath::Max(1, FMath::CeilToInt(MaxDistanceCm / GridCellCm));
	int32 Best = INDEX_NONE;
	double BestD = FMath::Square(double(MaxDistanceCm));
	for (int32 DX = -Reach; DX <= Reach; ++DX)
	{
		for (int32 DY = -Reach; DY <= Reach; ++DY)
		{
			if (const TArray<int32>* Cell = Grid.Find(FIntPoint(C.X + DX, C.Y + DY)))
			{
				for (const int32 I : *Cell)
				{
					const double D = FVector::DistSquared2D(NodeLocations[I], WorldLocation);
					if (D < BestD) { BestD = D; Best = I; }
				}
			}
		}
	}
	return Best;
}

bool AHanoiTrafficGraph::FindPath(const FVector& Start, const FVector& End, bool bIsCar, bool bIgnoreOneway, TArray<FVector>& OutPoints, TArray<int32>& OutEdges) const
{
	OutPoints.Reset();
	OutEdges.Reset();
	const int32 S = FindNearestNode(Start);
	const int32 G = FindNearestNode(End);
	if (S == INDEX_NONE || G == INDEX_NONE)
	{
		return false;
	}

	struct FOpen
	{
		int32 Node;
		double F;
	};
	const auto Less = [](const FOpen& A, const FOpen& B) { return A.F < B.F; };
	const auto Heuristic = [this, G](int32 N) { return FVector::Dist2D(NodeLocations[N], NodeLocations[G]) / 100.0 / MaxSpeedMps; };

	TArray<double> Cost;
	Cost.Init(TNumericLimits<double>::Max(), NodeLocations.Num());
	TArray<int32> ViaEdge;
	ViaEdge.Init(INDEX_NONE, NodeLocations.Num());
	TArray<FOpen> Open;
	Cost[S] = 0.0;
	Open.HeapPush({S, Heuristic(S)}, Less);

	while (Open.Num() > 0)
	{
		FOpen Top;
		Open.HeapPop(Top, Less);
		if (Top.Node == G)
		{
			break;
		}
		if (Top.F > Cost[Top.Node] + Heuristic(Top.Node) + 1e-6)
		{
			continue;  // stale entry
		}
		for (const FLink& L : Adjacency[Top.Node])
		{
			const FHanoiTrafficEdge& E = Edges[L.Edge];
			if ((bIsCar && E.bMotorbikeOnly) || (L.bReverse && E.bOneway && !bIgnoreOneway))
			{
				continue;
			}
			const int32 Next = L.bReverse ? E.From : E.To;
			const double NewCost = Cost[Top.Node] + E.LengthM / (E.SpeedKmh / 3.6);
			if (NewCost < Cost[Next])
			{
				Cost[Next] = NewCost;
				ViaEdge[Next] = L.Edge;
				Open.HeapPush({Next, NewCost + Heuristic(Next)}, Less);
			}
		}
	}
	if (S != G && ViaEdge[G] == INDEX_NONE)
	{
		return false;
	}

	// Walk back from the goal, then emit polylines in travel order.
	TArray<TPair<int32, bool>> Route;
	for (int32 N = G; N != S;)
	{
		const FHanoiTrafficEdge& E = Edges[ViaEdge[N]];
		const bool bReverse = E.To != N;
		Route.Emplace(ViaEdge[N], bReverse);
		N = bReverse ? E.To : E.From;
	}
	Algo::Reverse(Route);
	OutPoints.Add(NodeLocations[S]);
	for (const TPair<int32, bool>& Step : Route)
	{
		OutEdges.Add(Step.Key);
		const TArray<FVector>& Poly = Edges[Step.Key].Polyline;
		for (int32 I = 1; I < Poly.Num(); ++I)
		{
			OutPoints.Add(Step.Value ? Poly[Poly.Num() - 1 - I] : Poly[I]);
		}
	}
	return true;
}

void AHanoiTrafficGraph::DrawDebugGraph() const
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	for (const FHanoiTrafficEdge& E : Edges)
	{
		const FColor Color = E.bMotorbikeOnly ? FColor::Orange : (E.bOneway ? FColor::Cyan : FColor::Green);
		for (int32 I = 1; I < E.Polyline.Num(); ++I)
		{
			DrawDebugLine(World, E.Polyline[I - 1] + FVector(0, 0, 50), E.Polyline[I] + FVector(0, 0, 50), Color, false, 30.f, 0, 30.f);
		}
	}
	for (int32 I = 0; I < NodeLocations.Num(); ++I)
	{
		if (NodeSignals[I])
		{
			DrawDebugSphere(World, NodeLocations[I] + FVector(0, 0, 100), 150.f, 8, FColor::Red, false, 30.f);
		}
	}
}
