# MealMate Testing Record

Complete this record yourself before submission. Enter the date, browser or device, result and any corrective action. This provides evidence that you tested the application rather than relying on appearance alone.

| Test | Expected result | Result and evidence |
|---|---|---|
| Submit an empty form | Clear messages identify missing name, ingredient and cooking confidence | To complete |
| Search for `chicken` | Recipe cards are displayed | To complete |
| Apply a category and cuisine that do not match | Helpful empty-result message is displayed | To complete |
| Enter a valid city | Current temperature and meal guidance appear | To complete |
| Enter an unknown city | Recipes remain available and weather error is explained | To complete |
| Disconnect from the internet | API error appears without breaking the page | To complete |
| Save and remove a favourite | Favourite cards and counter update | To complete |
| Refresh after saving a favourite | Favourite remains stored | To complete |
| Use only Tab, Shift+Tab, Enter and Space | Every control can be reached and operated | To complete |
| Zoom browser to 200% | Content remains readable without horizontal page scrolling | To complete |
| Test at 375px width | Navigation, form and cards fit the viewport | To complete |
| Test at desktop width | Layout uses available space without excessive line length | To complete |
| Run W3C HTML validation | Record and resolve relevant errors | To complete |
| Run W3C CSS validation | Record and resolve relevant errors | To complete |
| Run Lighthouse accessibility audit | Record score and resolve meaningful issues | To complete |

## Manual accessibility checks

- Confirm that the skip link appears when focused.
- Confirm that focus is always visible.
- Confirm that form labels announce correctly with a screen reader.
- Confirm that validation and API messages are announced.
- Confirm that meaning does not rely on colour alone.
- Confirm that light and dark themes both retain readable contrast.
