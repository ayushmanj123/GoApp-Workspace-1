using System.Text.Json;
using Microsoft.PowerFx;
using Microsoft.PowerFx.Types;

namespace GoApps.PowerFx;

public sealed class PowerFxEvaluator
{
    public static readonly string[] HostFunctions =
    [
        "Set",
        "UpdateContext",
        "Navigate",
        "Collect",
        "ClearCollect",
        "Clear",
        "Patch",
        "Remove",
        "Defaults",
        "SubmitForm",
        "ResetForm",
        "NewForm",
        "EditForm",
        "ViewForm",
        "Refresh",
        "Back",
        "Notify",
        "Reset",
        "Select",
        "Launch",
        "Sort",
        "SortByColumns",
        "Search",
        "ForAll",
    ];

    private readonly RecalcEngine _engine = new();
    private readonly FormulaValue _color = BuildColorRecord();
    private readonly object _gate = new();

    public object? Evaluate(
        string formula,
        IReadOnlyDictionary<string, JsonElement>? context = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(formula);

        var fields = new List<NamedValue> { new("Color", _color) };
        if (context is not null)
        {
            foreach (var (name, value) in context)
            {
                if (name.Equals("Color", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
                {
                    continue;
                }

                fields.Add(new NamedValue(name, JsonToFormulaValue(value)));
            }
        }

        var parameters = FormulaValue.NewRecordFromFields(fields.ToArray());
        FormulaValue result;
        lock (_gate)
        {
            result = _engine.Eval(formula, parameters);
        }

        return result.ToObject();
    }

    public IReadOnlyList<string> ListFunctions()
    {
        var names = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in _engine.GetAllFunctionNames())
        {
            if (!string.IsNullOrWhiteSpace(name))
            {
                names.Add(name);
            }
        }

        foreach (var name in HostFunctions)
        {
            names.Add(name);
        }

        return names.ToArray();
    }

    private static FormulaValue JsonToFormulaValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => FormulaValue.New(element.GetString()),
            JsonValueKind.Number => FormulaValue.New(element.GetDecimal()),
            JsonValueKind.True => FormulaValue.New(true),
            JsonValueKind.False => FormulaValue.New(false),
            JsonValueKind.Null or JsonValueKind.Undefined => FormulaValue.NewBlank(),
            JsonValueKind.Object => FormulaValue.NewRecordFromFields(
                element
                    .EnumerateObject()
                    .Where(property => property.Value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined)
                    .Select(property => new NamedValue(
                        property.Name,
                        JsonToFormulaValue(property.Value)))
                    .ToArray()),
            JsonValueKind.Array => JsonArrayToTable(element),
            _ => FormulaValue.NewBlank(),
        };
    }

    private static FormulaValue JsonArrayToTable(JsonElement element)
    {
        var items = element.EnumerateArray().ToArray();
        if (items.Length == 0)
        {
            return FormulaValue.NewTable(RecordType.Empty(), Array.Empty<RecordValue>());
        }

        var records = items
            .Select(item =>
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    return (RecordValue)JsonToFormulaValue(item);
                }

                return (RecordValue)FormulaValue.NewRecordFromFields(
                    new NamedValue("Value", JsonToFormulaValue(item)));
            })
            .ToArray();

        return FormulaValue.NewTable(records[0].Type, records);
    }

    private static FormulaValue BuildColorRecord()
    {
        var fields = CssColors
            .Select(pair => new NamedValue(pair.Key, FormulaValue.New(pair.Value)))
            .ToArray();
        return FormulaValue.NewRecordFromFields(fields);
    }

    private static readonly Dictionary<string, string> CssColors = new(StringComparer.Ordinal)
    {
        ["AliceBlue"] = "#F0F8FF",
        ["AntiqueWhite"] = "#FAEBD7",
        ["Aqua"] = "#00FFFF",
        ["Aquamarine"] = "#7FFFD4",
        ["Azure"] = "#F0FFFF",
        ["Beige"] = "#F5F5DC",
        ["Bisque"] = "#FFE4C4",
        ["Black"] = "#000000",
        ["BlanchedAlmond"] = "#FFEBCD",
        ["Blue"] = "#0000FF",
        ["BlueViolet"] = "#8A2BE2",
        ["Brown"] = "#A52A2A",
        ["BurlyWood"] = "#DEB887",
        ["CadetBlue"] = "#5F9EA0",
        ["Chartreuse"] = "#7FFF00",
        ["Chocolate"] = "#D2691E",
        ["Coral"] = "#FF7F50",
        ["CornflowerBlue"] = "#6495ED",
        ["Cornsilk"] = "#FFF8DC",
        ["Crimson"] = "#DC143C",
        ["Cyan"] = "#00FFFF",
        ["DarkBlue"] = "#00008B",
        ["DarkCyan"] = "#008B8B",
        ["DarkGoldenrod"] = "#B8860B",
        ["DarkGray"] = "#A9A9A9",
        ["DarkGreen"] = "#006400",
        ["DarkKhaki"] = "#BDB76B",
        ["DarkMagenta"] = "#8B008B",
        ["DarkOliveGreen"] = "#556B2F",
        ["DarkOrange"] = "#FF8C00",
        ["DarkOrchid"] = "#9932CC",
        ["DarkRed"] = "#8B0000",
        ["DarkSalmon"] = "#E9967A",
        ["DarkSeaGreen"] = "#8FBC8F",
        ["DarkSlateBlue"] = "#483D8B",
        ["DarkSlateGray"] = "#2F4F4F",
        ["DarkTurquoise"] = "#00CED1",
        ["DarkViolet"] = "#9400D3",
        ["DeepPink"] = "#FF1493",
        ["DeepSkyBlue"] = "#00BFFF",
        ["DimGray"] = "#696969",
        ["DodgerBlue"] = "#1E90FF",
        ["Firebrick"] = "#B22222",
        ["FloralWhite"] = "#FFFAF0",
        ["ForestGreen"] = "#228B22",
        ["Fuchsia"] = "#FF00FF",
        ["Gainsboro"] = "#DCDCDC",
        ["GhostWhite"] = "#F8F8FF",
        ["Gold"] = "#FFD700",
        ["Goldenrod"] = "#DAA520",
        ["Gray"] = "#808080",
        ["Green"] = "#008000",
        ["GreenYellow"] = "#ADFF2F",
        ["Honeydew"] = "#F0FFF0",
        ["HotPink"] = "#FF69B4",
        ["IndianRed"] = "#CD5C5C",
        ["Indigo"] = "#4B0082",
        ["Ivory"] = "#FFFFF0",
        ["Khaki"] = "#F0E68C",
        ["Lavender"] = "#E6E6FA",
        ["LavenderBlush"] = "#FFF0F5",
        ["LawnGreen"] = "#7CFC00",
        ["LemonChiffon"] = "#FFFACD",
        ["LightBlue"] = "#ADD8E6",
        ["LightCoral"] = "#F08080",
        ["LightCyan"] = "#E0FFFF",
        ["LightGoldenrodYellow"] = "#FAFAD2",
        ["LightGray"] = "#D3D3D3",
        ["LightGreen"] = "#90EE90",
        ["LightPink"] = "#FFB6C1",
        ["LightSalmon"] = "#FFA07A",
        ["LightSeaGreen"] = "#20B2AA",
        ["LightSkyBlue"] = "#87CEFA",
        ["LightSlateGray"] = "#778899",
        ["LightSteelBlue"] = "#B0C4DE",
        ["LightYellow"] = "#FFFFE0",
        ["Lime"] = "#00FF00",
        ["LimeGreen"] = "#32CD32",
        ["Linen"] = "#FAF0E6",
        ["Magenta"] = "#FF00FF",
        ["Maroon"] = "#800000",
        ["MediumAquamarine"] = "#66CDAA",
        ["MediumBlue"] = "#0000CD",
        ["MediumOrchid"] = "#BA55D3",
        ["MediumPurple"] = "#9370DB",
        ["MediumSeaGreen"] = "#3CB371",
        ["MediumSlateBlue"] = "#7B68EE",
        ["MediumSpringGreen"] = "#00FA9A",
        ["MediumTurquoise"] = "#48D1CC",
        ["MediumVioletRed"] = "#C71585",
        ["MidnightBlue"] = "#191970",
        ["MintCream"] = "#F5FFFA",
        ["MistyRose"] = "#FFE4E1",
        ["Moccasin"] = "#FFE4B5",
        ["NavajoWhite"] = "#FFDEAD",
        ["Navy"] = "#000080",
        ["OldLace"] = "#FDF5E6",
        ["Olive"] = "#808000",
        ["OliveDrab"] = "#6B8E23",
        ["Orange"] = "#FFA500",
        ["OrangeRed"] = "#FF4500",
        ["Orchid"] = "#DA70D6",
        ["PaleGoldenrod"] = "#EEE8AA",
        ["PaleGreen"] = "#98FB98",
        ["PaleTurquoise"] = "#AFEEEE",
        ["PaleVioletRed"] = "#DB7093",
        ["PapayaWhip"] = "#FFEFD5",
        ["PeachPuff"] = "#FFDAB9",
        ["Peru"] = "#CD853F",
        ["Pink"] = "#FFC0CB",
        ["Plum"] = "#DDA0DD",
        ["PowderBlue"] = "#B0E0E6",
        ["Purple"] = "#800080",
        ["RebeccaPurple"] = "#663399",
        ["Red"] = "#FF0000",
        ["RosyBrown"] = "#BC8F8F",
        ["RoyalBlue"] = "#4169E1",
        ["SaddleBrown"] = "#8B4513",
        ["Salmon"] = "#FA8072",
        ["SandyBrown"] = "#F4A460",
        ["SeaGreen"] = "#2E8B57",
        ["SeaShell"] = "#FFF5EE",
        ["Sienna"] = "#A0522D",
        ["Silver"] = "#C0C0C0",
        ["SkyBlue"] = "#87CEEB",
        ["SlateBlue"] = "#6A5ACD",
        ["SlateGray"] = "#708090",
        ["Snow"] = "#FFFAFA",
        ["SpringGreen"] = "#00FF7F",
        ["SteelBlue"] = "#4682B4",
        ["Tan"] = "#D2B48C",
        ["Teal"] = "#008080",
        ["Thistle"] = "#D8BFD8",
        ["Tomato"] = "#FF6347",
        ["Turquoise"] = "#40E0D0",
        ["Violet"] = "#EE82EE",
        ["Wheat"] = "#F5DEB3",
        ["White"] = "#FFFFFF",
        ["WhiteSmoke"] = "#F5F5F5",
        ["Yellow"] = "#FFFF00",
        ["YellowGreen"] = "#9ACD32",
    };
}
