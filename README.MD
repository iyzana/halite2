# halite 2

@hesch and my bot for the 2nd [halite](https://2017.halite.io/) Ai competition.
Thank you [Two Sigma](https://www.twosigma.com/) for this amazing contest.

The bot is written in JavaScript and consists of all files found in the `src/` directory.  
All uploaded bot versions have their respective commits tagged.  
The (partially modified) tooling we used during the competition is also included.
Thank you [fohristiwhirl](https://github.com/fohristiwhirl) for the awesome replay viewer.

# bot parts

## navigation

During navigation only planets and docked ships are considered obstacles.
Collisions with moving obstacles are resolved in collision avoidance.

Navigation is set up recursively.
At first a straight line to the target location is drawn.
Every obstacle that intersects that line is then found.
The farthest of these obstacles is selected and will be used for the rest of the method call.
The two intersection points of the tangents on that obstacle are then computed.
Of these intersection points the one closest to the target is selected.
That point is then recursively passed to the navigation function.
The recursion depth limit is set to 6 and if one branch did not yield a solution the process is repeated with the other intersection point.
If no path is found at all speed and angle zero are returned.

### enemy avoidance

It is possible to pass a custom list of additional obstacles to the navigation.
This is frequently used to avoid undocked enemies when we want to attack docked ones or similar cases.
The radius of these enemy-obstacles is set to the radius they can reach with their attacks next turn which is
`max_speed + weapon_range + 2 * ship_radius = 13`.
By passing these obstacles, a vector is computed, that circumvents these enemies, as they are just seen as normal obstacles present on the map.

It is then also possible that a ship currently is inside one or multiple of these enemy radii.
In that case we intersect our ships movement radius with each enemy radius and compute the angle interval for a safe escape.
We then find an overlap in the computed intervals and use that as the escape angle.
If the intervals have no overlap we weight them by distance to enemy they come from and average their midpoints.
If we are completely inside an enemy radius and can't escape it we fall back to retreating in a straight line from it.

Each sentence that contained the word angle from the last paragraph was complex to implement as it was increasingly harder to handle the 360 to 0 degrees special case in the angular calculations.

## defense

At first agressive enemies are determined.
An enemy is agreesive if:
- its distance to the planet is smaller than the next tick attack radius
- its movement vector stretched to 50 intersects with the planets dock radius + 3
    - and there are no other planets in the way
    - and the planet is roughly the closest one the enemy would consider an enemy planet

The smallest distance between any attacker and docked ship of that planet is then found, this is considered the attacked ship.
Based on the distance between the attacked ship and the closest agressor the turns till arrival are calculated.
We then simulate how many ships the planet will produce before that.
If enough ships will be produced or are already undocking no further action is required.
Otherwise ships from the surroundings are drawn in to defend.
If there are no ships nearby we will start undocking as many ships as there are agressors.
This way no special early game rush detection is required as this process covers that.
The defense position is simply as close to the attacked ship as possible.

# general structure

Most of the process is modelled in `strategies/goal/Goal.js`.  
Pre- and postprocessing happens in `strategies/Strategy.js`.  
Helper functions can be found in `hlt/Geometry.js` and `strategies/Simulation.js`.  
Navigation is in `strategies/LineNavigation.js`.  
  
The bot processes the map in the following order.

### receive map

This is using the JavaScript starter bots code.

### gather metadata

Data that will be frequently used throughout computation
- percentage of my ships
- planet distances (also to enemy planets)
- populated planet pct

### collect all goals we want to achieve

This collects all goals independent of if they are relevant now.
Goals are defined in `src/strategies/goal`.
- attack each enemy bunch `AttackGoal.js`
- populate all planets `DockingGoal.js`
- defend all ships `DefenseGoal.js`
- kamikaze with each ship `KamikazeGoal.js`
- harass each enemy `HarassmentGoal.js`

### score the goals

Each goal then goes ahead and scores itself.
This is the most important part in regulating macro behaviour.
It happens in the `calculateGoalScore` method of each goal.

### score the ships per goal

Every goal then assigns each ship a score of how badly it needs that ship in `shipRequests`.
This includes not wanting any ship at all, for example when no defense is needed.
These scores are then multiplied with the goals score.

### assign ships to goals

As a last step before computing actions the goals can limit the number of ships they get assigened.
They report the maximum in `effectivenessPerShip`.
This is used to avoid many ships chasing a single enemy or assigning more ships to dock than the planet can fit.

### compute actions

Each goal gets its assigned ships and computes the moves in `getShipCommands`.
This step is where micromanaging ships happens.
In this step all the pathfinding is run.

### postprocess moves

The actions are first modeled as `ActionDock.js` and `ActionThrust.js` for easier processing.
As a final step all generated moves are checked for collisions.
Collision avoidance respects the following cases:
- When two ships target the same location (<1.0 distance), the ship further away gets slowed down
- When two ships paths cross and collide their target locations are swapped
- When a ship targets a location outside the map, an angle is computed so it does not collide anymore
- When two ships are nearby and have a similar angle (< 5° difference), their angles are aligned
- When a ship crashes with a stationary object (can happen after above corrections), set the angle to the tangent

### send moves

# version history

## v3

This is the first revision in version control and I don't really know what happened before that.
It's weighs planets by dockingSpots and distance.

## more to come (i'll have to go through the commit history)
