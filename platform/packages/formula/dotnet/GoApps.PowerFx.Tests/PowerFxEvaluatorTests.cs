using System.Text.Json;
using GoApps.PowerFx;
using Xunit;

namespace GoApps.PowerFx.Tests;

public class PowerFxEvaluatorTests
{
    private readonly PowerFxEvaluator _evaluator = new();

    private static Dictionary<string, JsonElement> Context(
        params (string Key, object Value)[] entries)
    {
        var json = JsonSerializer.Serialize(
            entries.ToDictionary(entry => entry.Key, entry => entry.Value));
        return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json)!;
    }

    [Fact]
    public void Evaluate_StringLiteral_ReturnsHello()
    {
        var result = _evaluator.Evaluate("\"Hello\"");
        Assert.Equal("Hello", result);
    }

    [Fact]
    public void Evaluate_NumberLiteral_Returns123()
    {
        var result = _evaluator.Evaluate("123");
        Assert.Equal(123, Convert.ToDecimal(result));
    }

    [Fact]
    public void Evaluate_BooleanLiteral_ReturnsTrue()
    {
        var result = _evaluator.Evaluate("true");
        Assert.Equal(true, result);
    }

    [Fact]
    public void Evaluate_UserFullName_ReturnsTestUser()
    {
        var context = Context(
            ("User", new { FullName = "Test User", Email = "test@example.com" }));
        var result = _evaluator.Evaluate("User.FullName", context);
        Assert.Equal("Test User", result);
    }

    [Fact]
    public void Evaluate_UserEmail_ReturnsEmail()
    {
        var context = Context(
            ("User", new { FullName = "Test User", Email = "test@example.com" }));
        var result = _evaluator.Evaluate("User.Email", context);
        Assert.Equal("test@example.com", result);
    }

    [Fact]
    public void Evaluate_AppName_ReturnsAppName()
    {
        var context = Context(("App", new { Name = "Incident App" }));
        var result = _evaluator.Evaluate("App.Name", context);
        Assert.Equal("Incident App", result);
    }

    [Fact]
    public void Evaluate_UnknownUserProperty_Throws()
    {
        var context = Context(
            ("User", new { FullName = "Test User", Email = "test@example.com" }));
        Assert.ThrowsAny<Exception>(() => _evaluator.Evaluate("User.Phone", context));
    }

    [Fact]
    public void Evaluate_TextInputValue_ReturnsHello()
    {
        var context = Context(
            ("TextInput1", new { Value = "Hello" }));
        var result = _evaluator.Evaluate("TextInput1.Value", context);
        Assert.Equal("Hello", result);
    }

    [Fact]
    public void Evaluate_LabelText_ReturnsApproved()
    {
        var context = Context(
            ("Label1", new { Text = "Approved" }));
        var result = _evaluator.Evaluate("Label1.Text", context);
        Assert.Equal("Approved", result);
    }

    [Fact]
    public void Evaluate_MissingControl_Throws()
    {
        Assert.ThrowsAny<Exception>(() => _evaluator.Evaluate("MissingControl.Text"));
    }
}
