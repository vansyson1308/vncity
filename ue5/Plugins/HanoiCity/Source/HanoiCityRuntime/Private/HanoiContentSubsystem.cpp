#include "HanoiContentSubsystem.h"
#include "HanoiCitySettings.h"

void UHanoiContentSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	ReloadTables();
}

void UHanoiContentSubsystem::ReloadTables()
{
	Tables.Reset();
	const FString Root = UHanoiCitySettings::Get()->ContentTablePath;
	HanoiGenerated::ForEachCollection([this, &Root](FName Collection, UScriptStruct* RowStruct)
	{
		const FString Name = FString::Printf(TEXT("DT_%s"), *Collection.ToString());
		const FString Path = FString::Printf(TEXT("%s/%s.%s"), *Root, *Name, *Name);
		UDataTable* Table = LoadObject<UDataTable>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
		if (!Table)
		{
			UE_LOG(LogHanoi, Verbose, TEXT("No content table %s"), *Path);
			return;
		}
		if (Table->GetRowStruct() != RowStruct)
		{
			UE_LOG(LogHanoi, Error, TEXT("%s has row struct %s, expected %s; re-run import_content.py"),
				*Path, *GetNameSafe(Table->GetRowStruct()), *GetNameSafe(RowStruct));
			return;
		}
		Tables.Add(Collection, Table);
	});
	UE_LOG(LogHanoi, Log, TEXT("Loaded %d content tables from %s"), Tables.Num(), *Root);
}

UDataTable* UHanoiContentSubsystem::GetTable(FName Collection) const
{
	const TObjectPtr<UDataTable>* Found = Tables.Find(Collection);
	return Found ? Found->Get() : nullptr;
}

bool UHanoiContentSubsystem::HasRow(const FHanoiRef& Ref) const
{
	const UDataTable* Table = GetTable(Ref.Collection);
	return Table && Table->GetRowMap().Contains(Ref.Id);
}

namespace
{
	template <typename RowType>
	bool CopyRow(const UHanoiContentSubsystem* Self, FName Collection, FName Id, RowType& Out)
	{
		if (const RowType* Row = Self->Find<RowType>(Collection, Id))
		{
			Out = *Row;
			return true;
		}
		return false;
	}
}

bool UHanoiContentSubsystem::GetMission(FName Id, FHanoiMissionRow& OutRow) const { return CopyRow(this, TEXT("missions"), Id, OutRow); }
bool UHanoiContentSubsystem::GetDialogue(FName Id, FHanoiDialogueRow& OutRow) const { return CopyRow(this, TEXT("dialogues"), Id, OutRow); }
bool UHanoiContentSubsystem::GetCharacter(FName Id, FHanoiCharacterRow& OutRow) const { return CopyRow(this, TEXT("characters"), Id, OutRow); }
bool UHanoiContentSubsystem::GetTrafficRule(FName Id, FHanoiTrafficRuleRow& OutRow) const { return CopyRow(this, TEXT("traffic_rules"), Id, OutRow); }

bool UHanoiContentSubsystem::ResolveLocation(const FHanoiRef& Ref, FHanoiGeo& OutGeo) const
{
	const FName C = Ref.Collection;
	if (C == TEXT("landmarks")) { if (const auto* R = Find<FHanoiLandmarkRow>(Ref)) { OutGeo = R->Location; } }
	else if (C == TEXT("businesses")) { if (const auto* R = Find<FHanoiBusinessRow>(Ref)) { OutGeo = R->Location; } }
	else if (C == TEXT("characters")) { if (const auto* R = Find<FHanoiCharacterRow>(Ref)) { OutGeo = R->Home; } }
	else if (C == TEXT("districts")) { if (const auto* R = Find<FHanoiDistrictRow>(Ref)) { OutGeo = R->Center; } }
	else if (C == TEXT("factions")) { if (const auto* R = Find<FHanoiFactionRow>(Ref)) { OutGeo = R->Base; } }
	else { return false; }
	return OutGeo.bIsSet;
}

int64 UHanoiContentSubsystem::EnumValueFromContentString(const UEnum* Enum, const FString& Value)
{
	if (!Enum)
	{
		return -1;
	}
	// Same rule as tools/codegen_ue.py pascal(): split on non-alphanumerics, capitalise each part,
	// keep "_" between two parts that both start with a digit.
	FString Ident;
	TArray<FString> Parts;
	Value.ParseIntoArray(Parts, TEXT("_"), true);
	for (const FString& Part : Parts)
	{
		if (!Ident.IsEmpty() && FChar::IsDigit(Ident[Ident.Len() - 1]) && FChar::IsDigit(Part[0]))
		{
			Ident += TEXT("_");
		}
		Ident += Part.Left(1).ToUpper() + Part.Mid(1);
	}
	return Enum->GetValueByNameString(Ident);
}
