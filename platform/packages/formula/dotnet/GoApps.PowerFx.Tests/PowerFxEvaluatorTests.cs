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

    [Fact]
    public void Evaluate_VarTitle_ReturnsHelloWorld()
    {
        var context = Context(("varTitle", "Hello World"));
        var result = _evaluator.Evaluate("varTitle", context);
        Assert.Equal("Hello World", result);
    }

    [Fact]
    public void Evaluate_VarCount_Returns10()
    {
        var context = Context(("varCount", 10));
        var result = _evaluator.Evaluate("varCount", context);
        Assert.Equal(10, Convert.ToDecimal(result));
    }

    [Fact]
    public void Evaluate_VarStatus_ReturnsApproved()
    {
        var context = Context(("varStatus", "Approved"));
        var result = _evaluator.Evaluate("varStatus", context);
        Assert.Equal("Approved", result);
    }

    [Fact]
    public void Evaluate_UnknownVariable_Throws()
    {
        Assert.ThrowsAny<Exception>(() => _evaluator.Evaluate("varUnknown"));
    }

    private static Dictionary<string, JsonElement> FullContext() =>
        Context(
            ("User", new { FullName = "Test User", Email = "test@example.com" }),
            ("App", new { Name = "Demo Application" }),
            ("TextInput1", new { Value = "Hello" }),
            ("Label1", new { Text = "Approved" }),
            ("varTitle", "Hello World"),
            ("varCount", 10),
            ("varStatus", "Approved"));

    [Fact]
    public void Evaluate_UpperUserFullName_ReturnsTestUser()
    {
        var result = _evaluator.Evaluate("Upper(User.FullName)", FullContext());
        Assert.Equal("TEST USER", result);
    }

    [Fact]
    public void Evaluate_LowerUserEmail_ReturnsLowercaseEmail()
    {
        var result = _evaluator.Evaluate("Lower(User.Email)", FullContext());
        Assert.Equal("test@example.com", result);
    }

    [Fact]
    public void Evaluate_ConcatenateHelloUser_ReturnsGreeting()
    {
        var result = _evaluator.Evaluate(
            "Concatenate(\"Hello \", User.FullName)",
            FullContext());
        Assert.Equal("Hello Test User", result);
    }

    [Fact]
    public void Evaluate_LenVarTitle_Returns11()
    {
        var result = _evaluator.Evaluate("Len(varTitle)", FullContext());
        Assert.Equal(11, Convert.ToDecimal(result));
    }

    [Fact]
    public void Evaluate_IfTrue_ReturnsApproved()
    {
        var result = _evaluator.Evaluate(
            "If(true, \"Approved\", \"Rejected\")",
            FullContext());
        Assert.Equal("Approved", result);
    }

    [Fact]
    public void Evaluate_IfFalse_ReturnsRejected()
    {
        var result = _evaluator.Evaluate(
            "If(false, \"Approved\", \"Rejected\")",
            FullContext());
        Assert.Equal("Rejected", result);
    }

    [Fact]
    public void Evaluate_UnknownFunction_Throws()
    {
        Assert.ThrowsAny<Exception>(
            () => _evaluator.Evaluate("SomeUnknownFunction()", FullContext()));
    }
}
