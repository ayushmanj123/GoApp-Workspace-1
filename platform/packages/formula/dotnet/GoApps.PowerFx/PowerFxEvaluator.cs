using System.Text.Json;
using Microsoft.PowerFx;
using Microsoft.PowerFx.Types;

namespace GoApps.PowerFx;

public sealed class PowerFxEvaluator
{
    public object? Evaluate(
        string formula,
        IReadOnlyDictionary<string, JsonElement>? context = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(formula);

        var engine = new RecalcEngine();
        if (context is not null)
        {
            foreach (var (name, value) in context)
            {
                engine.UpdateVariable(name, JsonToFormulaValue(value));
            }
        }

        var result = engine.Eval(formula);
        return result.ToObject();
    }

    private static FormulaValue JsonToFormulaValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => FormulaValue.New(element.GetString()),
            JsonValueKind.Number => FormulaValue.New(element.GetDecimal()),
            JsonValueKind.True => FormulaValue.New(true),
            JsonValueKind.False => FormulaValue.New(false),
            JsonValueKind.Object => FormulaValue.NewRecordFromFields(
                element
                    .EnumerateObject()
                    .Select(property => new NamedValue(
                        property.Name,
                        JsonToFormulaValue(property.Value)))
                    .ToArray()),
            _ => throw new ArgumentException(
                $"Unsupported JSON value kind: {element.ValueKind}"),
        };
    }
}
