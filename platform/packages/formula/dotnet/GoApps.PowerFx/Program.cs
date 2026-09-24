using System.Text.Json;
using System.Text.Json.Serialization;

namespace GoApps.PowerFx;

public sealed record EvaluateRequest(
    string Formula,
    Dictionary<string, JsonElement>? Context = null);

public sealed record EvaluateResponse(
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("value")] object? Value = null,
    [property: JsonPropertyName("error")] string? Error = null
);

public static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static int Main(string[] args)
    {
        if (args.Contains("--serve"))
        {
            RunHttpServer(args);
            return 0;
        }

        if (args.Length > 0 && args[0] == "--self-test")
        {
            return RunSelfTest();
        }

        return RunCliMode();
    }

    private static void RunHttpServer(string[] args)
    {
        var port = 8085;
        var portIndex = Array.IndexOf(args, "--port");
        if (portIndex >= 0 && portIndex + 1 < args.Length)
        {
            _ = int.TryParse(args[portIndex + 1], out port);
        }

        var builder = WebApplication.CreateBuilder();
        builder.Services.AddSingleton<PowerFxEvaluator>();
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
            });
        });

        var app = builder.Build();
        app.UseCors();

        app.MapGet("/health", () => Results.Json(new { ok = true }));

        app.MapGet("/functions", (PowerFxEvaluator evaluator) =>
            Results.Json(new { ok = true, functions = evaluator.ListFunctions() }, JsonOptions));

        app.MapPost("/evaluate", (EvaluateRequest request, PowerFxEvaluator evaluator) =>
        {
            if (string.IsNullOrWhiteSpace(request.Formula))
            {
                return Results.Json(
                    new EvaluateResponse(false, Error: "Formula is required."),
                    JsonOptions
                );
            }

            try
            {
                var value = evaluator.Evaluate(request.Formula, request.Context);
                return Results.Json(new EvaluateResponse(true, Value: value), JsonOptions);
            }
            catch (Exception ex)
            {
                return Results.Json(
                    new EvaluateResponse(false, Error: ex.Message),
                    JsonOptions
                );
            }
        });

        app.Run($"http://localhost:{port}");
    }

    private static int RunCliMode()
    {
        try
        {
            var input = Console.In.ReadToEnd();
            var request = JsonSerializer.Deserialize<EvaluateRequest>(input, JsonOptions);

            if (request is null || string.IsNullOrWhiteSpace(request.Formula))
            {
                WriteResponse(new EvaluateResponse(false, Error: "Formula is required."));
                return 1;
            }

            var evaluator = new PowerFxEvaluator();
            var value = evaluator.Evaluate(request.Formula, request.Context);
            WriteResponse(new EvaluateResponse(true, Value: value));
            return 0;
        }
        catch (Exception ex)
        {
            WriteResponse(new EvaluateResponse(false, Error: ex.Message));
            return 1;
        }
    }

    private static int RunSelfTest()
    {
        var evaluator = new PowerFxEvaluator();
        var checks = new (string Formula, object? Expected)[]
        {
            ("\"Hello\"", "Hello"),
            ("123", 123),
            ("true", true),
        };

        foreach (var (formula, expected) in checks)
        {
            var actual = evaluator.Evaluate(formula);
            if (!ValuesEqual(actual, expected))
            {
                Console.Error.WriteLine(
                    $"Self-test failed for {formula}: expected {expected}, got {actual}"
                );
                return 1;
            }
        }

        Console.WriteLine("Self-test passed.");
        return 0;
    }

    private static bool ValuesEqual(object? actual, object? expected)
    {
        if (actual is null || expected is null)
        {
            return Equals(actual, expected);
        }

        if (IsNumeric(actual) && IsNumeric(expected))
        {
            return Convert.ToDecimal(actual) == Convert.ToDecimal(expected);
        }

        return Equals(actual, expected);
    }

    private static bool IsNumeric(object value)
    {
        return value is byte or sbyte or short or ushort or int or uint or long or ulong
            or float or double or decimal;
    }

    private static void WriteResponse(EvaluateResponse response)
    {
        Console.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
    }
}
