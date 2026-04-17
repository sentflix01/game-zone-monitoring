# Requirements Document

## Introduction

This feature enhances the console session page (Consoles.jsx) in the PS4/PS5 gaming management app. Currently, when a user starts a session they must manually type the player's name each time. This feature introduces a "Current Player" quick-fill button, a running multi-game list for the same player, a running total price display, and a two-row session summary view that shows the previous player's completed data alongside the current player's live data — all scoped per console.

## Glossary

- **Console**: A PS4 or PS5 gaming unit managed by the app, represented as a card on the Consoles page.
- **Session**: A single timed gaming period on a Console, stored in the Session entity with fields: `console_id`, `player_name`, `start_time`, `end_time`, `duration_minutes`, `amount_charged`, `status`.
- **Current_Player**: The player whose name was most recently used to start a session on a given Console.
- **Game_Entry**: A single game played by the Current_Player within one continuous visit, before clicking "Start" to commit the session. Each Game_Entry has a name and a price.
- **Running_List**: The ordered list of Game_Entries accumulated for the Current_Player before the session is committed.
- **Running_Total**: The sum of prices of all Game_Entries in the Running_List.
- **Session_Summary_Row**: A single read-only row displayed in the console card showing a completed player's name, number of games played, and total amount charged.
- **Start_Button**: The button on the session start dialog that commits the current player's data and begins recording for the next player.
- **Current_Player_Button**: A button in the session start dialog that pre-fills the player name field with the Current_Player's name.
- **Session_Dialog**: The modal dialog opened when a user clicks "Start" on an available console card.
- **Console_Card**: The UI card representing a single console on the Consoles page.
- **Pricing**: The per-console-type hourly rate stored in the Pricing entity, used to calculate game prices.

## Requirements

### Requirement 1: Current Player Quick-Fill Button

**User Story:** As a staff member, I want to quickly reuse the last player's name when starting a new session on the same console, so that I don't have to retype the name when the same player plays multiple games back-to-back.

#### Acceptance Criteria

1. WHEN the Session_Dialog is opened for a Console that has a Current_Player, THE Session_Dialog SHALL display a Current_Player_Button labeled with the Current_Player's name.
2. WHEN the Current_Player_Button is clicked, THE Session_Dialog SHALL populate the player name input field with the Current_Player's name.
3. WHEN the Session_Dialog is opened for a Console that has no prior Current_Player (first session ever on that console), THE Session_Dialog SHALL NOT display the Current_Player_Button.
4. THE Console_Card SHALL persist the Current_Player's name per console independently, so that different consoles maintain their own Current_Player state.

### Requirement 2: Running Game List and Running Total

**User Story:** As a staff member, I want to add multiple games for the same player before committing the session, so that I can track all games played in one visit and show the player a running total.

#### Acceptance Criteria

1. WHEN the Session_Dialog is open and a player name has been entered, THE Session_Dialog SHALL display an "Add Game" input area allowing the staff member to enter a game name and a price.
2. WHEN a game is added to the Running_List, THE Session_Dialog SHALL append the Game_Entry to the bottom of the Running_List display.
3. WHEN one or more Game_Entries exist in the Running_List, THE Session_Dialog SHALL display the Running_Total as the sum of all Game_Entry prices.
4. THE Running_Total SHALL update immediately each time a Game_Entry is added or removed.
5. WHEN a Game_Entry is added, THE Session_Dialog SHALL clear the game name and price input fields so the staff member can enter the next game.
6. IF the staff member attempts to add a Game_Entry with an empty game name or a non-positive price, THEN THE Session_Dialog SHALL display a validation error and SHALL NOT add the entry to the Running_List.

### Requirement 3: Committing the Session via Start Button

**User Story:** As a staff member, I want clicking "Start" to save the current player's full session data (all games and total price) as a single summary, so that the console is ready for the next player.

#### Acceptance Criteria

1. WHEN the Start_Button is clicked and the Running_List contains at least one Game_Entry, THE Session_Dialog SHALL create a Session record with the player name, the list of games played, and the Running_Total as the `amount_charged`.
2. WHEN the Start_Button is clicked, THE Console_Card SHALL store the committed player's name as the new Current_Player for that console.
3. WHEN the Start_Button is clicked, THE Session_Dialog SHALL close and the Running_List SHALL be cleared.
4. WHEN the Start_Button is clicked and no Game_Entry has been added (Running_List is empty), THE Session_Dialog SHALL allow starting the session with zero games, treating it as a standard timed session (preserving existing behavior).
5. WHEN the Start_Button is clicked, THE Console_Card SHALL display a Session_Summary_Row for the just-committed player showing: player name, number of games played, and Running_Total amount.

### Requirement 4: Two-Row Session Display on Console Card

**User Story:** As a staff member, I want the console card to show only the previous player's summary and the current player's live data, so that the display stays clean and focused.

#### Acceptance Criteria

1. THE Console_Card SHALL display at most two Session_Summary_Rows at any time: one for the previous completed player and one for the current active player.
2. WHEN a new session is committed via the Start_Button, THE Console_Card SHALL replace the older of the two rows with the newly committed player's Session_Summary_Row, and begin showing the new active session row.
3. WHEN only one session has been completed on a Console, THE Console_Card SHALL display one Session_Summary_Row (the completed player) and one active session row (the current player).
4. WHEN no session has been completed on a Console, THE Console_Card SHALL display only the active session row with no previous Session_Summary_Row.
5. THE Session_Summary_Row for a completed player SHALL display: player name, total number of games played, and total amount charged.
6. THE active session row SHALL display: current player name, elapsed time, and Running_Total of games added so far.

### Requirement 5: Per-Console State Isolation

**User Story:** As a staff member managing multiple consoles simultaneously, I want each console to independently track its own Current_Player and session history display, so that activity on one console does not affect another.

#### Acceptance Criteria

1. THE Console_Card SHALL maintain Current_Player state independently per console, identified by `console_id`.
2. WHEN a session is started on Console A, THE Console_Card for Console B SHALL NOT be affected.
3. THE Running_List and Running_Total for a session SHALL be scoped to the specific Console_Card being operated.
4. WHEN the Session_Dialog is closed without clicking Start_Button, THE Running_List SHALL be discarded and the Current_Player SHALL remain unchanged.
