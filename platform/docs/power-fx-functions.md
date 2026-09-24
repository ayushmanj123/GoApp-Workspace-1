# Power Fx functions

Functions the GoApps formula service accepts in property formulas and actions.

| Function | Definition |
| --- | --- |
| Abs | Returns the absolute value of a number, a number without its sign. |
| Acos | Returns the arc cosine value (in radians) of a number. |
| Acot | Returns the arc cotangent value (in radians) of a number. |
| AddColumns | Returns a table with new columns computed by evaluating all 'expression' over 'source'. |
| And | Checks whether all arguments are true, and returns true if all arguments are true. |
| Asin | Returns the arc sine value (in radians) of a number. |
| AsType | Uses the provided value as the given type. |
| Atan | Returns the arc tangent value (in radians) of a number. |
| Atan2 | Returns the arctangent (in radians) of the specified x- and y-coordinates. |
| Average | Returns the average (arithmetic mean) of its arguments. |
| Back | Returns to the previous screen. |
| Blank | Returns a null (blank) value |
| Boolean | Converts a 'text' that represents a boolean to a boolean value. |
| Char | Returns the character specified by the code number from the character set on your platform. |
| Clear | Removes every row from a collection. |
| ClearCollect | Empties a collection, then adds the given records. |
| Coalesce | Returns the first non blank argument |
| Collect | Adds a record to a collection. |
| ColorFade | Produces a new shade of the specified 'color', based on the specified 'fade' percentage. |
| ColorValue | Returns the color corresponding to the given color string. |
| Column | Returns the value of a property of an untyped record, given the column name. |
| ColumnNames | Enumerate and returns the column names of an untyped record. |
| Concat | Joins all text values produced by evaluating the given expression over the given table into one text value. |
| Concatenate | Joins several text values into one text value. |
| Cos | Returns the cosine value of a number. |
| Cot | Returns the cotangent value of a number. |
| Count | Counts the numeric values in the specified column. |
| CountA | Counts the number of rows in the column that are not empty. |
| CountIf | Counts the number of rows that meet the given condition. |
| CountRows | Counts the number of rows in the input table or collection. |
| Date | Returns the number that represents the date in Power Apps date-time code. |
| DateAdd | Add the specified number of units to a date. |
| DateDiff | Calculate the difference between two dates. |
| DateTime | Creates a value that represents an instant in time, expressed as a date and time of the day. |
| DateTimeValue | Converts a date and time in the form of text to a number that represents the date in Power Apps date-time code. |
| DateValue | Converts a date in the form of text to a number that represents the date in Power Apps date-time code. |
| Day | Day returns the day of the month, a number from 1 to 31. |
| Dec2Hex | Converts a decimal number to hexadecimal |
| Decimal | Converts a 'text' that represents a number to a Decimal value. |
| Defaults | Returns the default field values for a new record. |
| Degrees | Returns the degrees value of a number. |
| Distinct | Evaluates an expression over one or more columns of the table and returns a one-column table that contains distinct (unique) values for the evaluated expression. |
| DropColumns | Returns a table with one or more specified 'columns' removed from the 'source' table. |
| EDate | Returns a date adjusted by a number of months. The day of the month remains the same but is capped by the number of days in the new month. |
| EditForm | Switches a form to edit mode. |
| EncodeHTML | Converts a text to an HTML-encoded text. |
| EncodeUrl | Encodes a URL string, replacing certain non-alphanumeric characters with % and a hexadecimal number. |
| EndsWith | Returns true if the provided text ends with the provided end string. |
| EOMonth | Returns the last day of the month for a specified date, adjusted by a number of months. |
| Error | Produces an error with custom values. |
| Exp | Returns E raised to the power of a number. To calculate powers of other bases, use the exponentiation operator (^). |
| Filter | Returns the rows from the table for which all the specified conditions are true. |
| Find | Returns the starting position of one text value within another text value. Find is case sensitive. |
| First | Returns the first row of 'source'. |
| FirstN | Returns the first 'count' rows of 'source'. |
| Float | Converts a 'text' that represents a number to a Float value. |
| ForAll | Applies a given formula on each row in a data source, then returns a new table with results per row. |
| GUID | Creates a GUID from a string, or returns a randomly generated GUID if no arguments are supplied. |
| Hex2Dec | Converts a hexadecimal number to decimal |
| Hour | Hour returns the hour as a number between 0 (12:00:00 AM) and 23 (11:00:00 PM). |
| If | Checks if any one of the specified conditions are met and returns the corresponding value. If none of the conditions are met, the function returns the specified default value. |
| IfError | Evaluates and returns the first non-error argument. |
| Index | Returns the record in a table at a given index. |
| Int | Truncates 'number' by rounding toward negative infinity. |
| IsBlank | Checks whether the expression results in blank, and returns true or false. |
| IsBlankOrError | Checks whether the expression results in blank result or an error, and returns true or false. |
| IsEmpty | Checks if a collection is empty and returns true or false. |
| IsError | Returns whether an error occurred when evaluating the given argument. |
| IsNumeric | Checks whether a value is a number, and returns true or false. |
| IsToday | Checks whether the given date is today, and returns true or false. |
| Language | Get the default locale set at runtime. |
| Last | Returns the last row of 'source'. |
| LastN | Returns the last 'count' rows of 'source'. |
| Launch | Opens an http or https address, or navigates to a screen in the app. |
| Left | Returns the specified number of characters from the start of a text value. |
| Len | Returns the number of characters in a text value. |
| Ln | Returns the natural logarithm (base E) of a number. |
| Log | Returns the logarithm of a number for the given base. The default base is 10. |
| LookUp | Looks up the first row for which the specified condition evaluates to true and returns the result of expression evaluated within the context of that row if provided an expression and the entire row otherwise. |
| Lower | Converts all letters in a text value to lowercase. |
| Max | Returns the largest value in a set of values. Ignores logical values and text. |
| Mid | Returns the characters from the middle of a text value, given a starting position and length. |
| Min | Returns the smallest value in a set of values. Ignores logical values and text. |
| Minute | Returns the minute, a number from 0 to 59. |
| Mod | Returns the remainder after a number is divided by a divisor. The result has the same sign as the divisor. |
| Month | Returns the month, a number from 1 (January) to 12 (December). |
| Navigate | Switches the running app to the named screen. |
| NewForm | Switches a form to new-record mode. |
| Not | Changes false to true and true to false. |
| Notify | Shows a short message in the preview banner. |
| Now | Returns the current date and time. |
| Or | Checks whether any of the arguments are true, and returns true or false. Returns false only if all arguments are false. |
| Patch | Returns row with updates applied. |
| Pi | Returns the value of pi. |
| PlainText | Removes all formatting and returns a plain text value. |
| Power | Raises a number x to the power of another number y. Same as x^y. |
| Proper | Converts a text value to proper case; the first letter in each word in uppercase, and all other letters to lowercase. |
| Radians | Returns the radians value of a number. |
| Rand | Returns a random number greater than or equal to 0 and less than 1, evenly distributed. |
| RandBetween | Returns a random number between bottom and top, evenly distributed. |
| Refresh | Refreshes the specified data source. |
| Remove | Removes a record from a data source or collection. |
| RenameColumns | Returns a copy of the specified 'source' table, with the 'old_column' column renamed to 'new_column'. |
| Replace | Replace part of a text value with a different text value. |
| Reset | Clears a control's current value so it returns to its default. |
| ResetForm | Discards unsaved changes on a form. |
| RGBA | Takes in numeric values for Red, Green, Blue and Alpha components of the color and generates the specific color. R, G, B are numeric between 0 to 255. Alpha is decimal between 0 to 1. |
| Right | Returns the specified number of characters from the end of a text value. |
| Round | Rounds 'number' to the specified number of digits. |
| RoundDown | Rounds 'number' down, toward zero. |
| RoundUp | Rounds 'number' up, away from zero. |
| Search | Searches text in 'source'. Returns rows where text is found. Comparison is done in case-insensitive manner. |
| Second | Returns the second, a number from 0 to 59. |
| Select | Runs another control's OnSelect formula. |
| Sequence | Generates a table of sequential numbers |
| Set | Stores a value in a global variable. |
| ShowColumns | Returns a table with all columns removed from the 'source' table except the specified columns. |
| Shuffle | Returns a randomly shuffled copy of the input 'source' table. |
| Sin | Returns the sine value of a number. |
| Sort | Sorts 'source' based on the results of the 'expression' evaluated for each row, optionally specifying a sort 'order'. |
| SortByColumns | Sorts 'source' based on the column, optionally specifying a sort 'order'. |
| Split | Splits a string into substrings using a delimiter. |
| Sqrt | Returns the square root of a number. |
| StartsWith | Returns true if the provided text starts with the provided start string. |
| StdevP | Calculates standard deviation based on the entire population given as arguments (ignores logical values and text). |
| SubmitForm | Saves the record currently shown on a form. |
| Substitute | Replaces existing text with new text in a text value. |
| Sum | Returns the sum of its arguments. |
| Summarize | Returns a grouping of the specified table, combining with aggregation functions. |
| Switch | Matches the result of a formula with a series of values. When a match is found, a corresponding formula is evaluated and returned. If no matches are found, the last default formula is evaluated and returned. |
| Table | Creates a table from the specified records and tables, with as many columns as there are unique record fields. For example: Table({key1: val1, key2: val2, ...}, ...) |
| Tan | Returns the tangent value of a number. |
| Text | Converts a 'value' to text in a specific number 'format_text'. |
| Time | Converts hours, minutes and seconds into a decimal number. |
| TimeValue | Converts a time in the form of text to a number that represents the date in Microsoft Power Apps date-time code, ignoring any date portion. |
| TimeZoneOffset | Returns the time difference between UTC time and local time, in minutes.For example, If your time zone is UTC+2, -120 will be returned. |
| Today | Returns the current date. |
| Trace | Logs information to Application Insights when enabled, and logs in a test studio session that will be available in the test results. |
| Trim | Removes all spaces from a text value except for single spaces between words. |
| TrimEnds | Removes all leading and trailing spaces from a text value. |
| Trunc | Truncates 'number' by rounding toward zero. |
| UniChar | Returns the Unicode character that is referenced by the given numeric value. |
| UpdateContext | Stores values in variables that belong to the current screen. |
| Upper | Converts a text value to all uppercase letters. |
| Value | Converts a 'text' that represents a number to a numeric value. |
| VarP | Calculates variance based on the entire population (ignores logical values and text in the population). |
| ViewForm | Switches a form to view mode. |
| Weekday | Returns the weekday of a datetime value. By default, the result ranges from 1 (Sunday) to 7 (Saturday). You can specify a different range with a StartOfWeek enumeration value or a Microsoft Excel Weekday function code. |
| WeekNum | Returns the week number for a given date. |
| With | Executes the formula provided as second parameter using the scope provided by the first. |
| Year | Year returns the year of a given date. |
