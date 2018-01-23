# halite 2

@hesch and my bot for the 2nd [halite](https://2017.halite.io/) ai competition.

The bot is written in JavaScript and consists of all files found in the src/ directory.  
All uploaded bot versions have their respective commits tagged.  
The (partially modified) tooling we used during the competition is also included.

# general structure

The bot process the map in the following order:

## receive map

## gather metadata

Data that will be frequently used throughout computation
- percentage of my ships
- planet distances (also to enemy planets)
- populated planet pct

## collect all goals we want to achieve

This collects all goals independent of if they are relevant now.
Goals are defined in `src/strategies/goal`.
- attack each enemy bunch
- populate all planets
- defend all ships
- kamikaze into each enemy
- harass each enemy

## score the goals

Each goal the goes ahead and scores itself.
This is the most important part in regulating makro behaviour.
It happens in the `calculateGoalScore` method of all goals.

## score the ships per goal

Every goal then assigns each ship a score of how badly it needs that ship.
This includes not wanting any ship at all, for example when no defense is needed.
These scores are the multiplied with the goal scores.

## assign ships to goals

As a last step before computing actions the goals can limit the number of ships they get assigened.
This is used to avoid many ships chasing a single enemy or assigning more ships to dock than the planet can fit.

## compute actions

Each goal gets its assigned ships and computes the required moves.
This step is where micromanaging ships happens.
In this step all the pathfinding is run.

## postprocess moves

As a final step all generated moves are checked for collisions.
Collision avoidance respects the following cases:
- When two ships target the same location (<1.0 distance), the bot further away gets slowed down
- When two ships paths cross and collide their target locations are swapped
- When a ship targets a location outside the map, an angle is computed so it does not collide anymore
- When two ships are nearby and have a similar angle (< 5° difference), their angles are aligned
- When a ship crashes with a stationary object (can happen after above corrections), set the angle to the tangent

## send moves

# version history

## v3

This is the first revision in version control and I don't know what happened before that.
It's weights planets by dockingSpots and distance

## more to come (i'll have to go through the commit history)
