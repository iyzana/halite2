import subprocess
import math
import re
from random import shuffle

_WINNING_RANK_STRING = "rank #1"
_SPACE_DELIMITER = ' '
_BOT_ID_POSITION = 1


def _determine_winner(game_result):
    """
    From the game result string, extract the winner's id.
    :param game_result: The result of running a game on the Halite binary
    :return:
    """
    return next(line for line in game_result.splitlines()
                if re.compile(_WINNING_RANK_STRING).search(line)).split(_SPACE_DELIMITER)[_BOT_ID_POSITION]


def _statistical_significance(games, bot1, bot2):
    if games < 30:
        return False

    pct1 = bot1 / games * 100
    pct2 = bot2 / games * 100

    error = 3 * math.sqrt((pct1 * (100 - pct1) / games) + (pct2 * (100 - pct2) / games))
    difference = abs(pct1 - pct2)

    return error < difference

def _play_game(binary, map_width, map_height, bot_commands):
    """
    Plays one game considering the specified bots and the game and map constraints.
    :param binary: The halite binary
    :param map_width: The map width
    :param map_height: The map height
    :param bot_commands: The commands to run each of the bots
    :return: The game's result string
    """
    game_run_command = '\"{}\" -d "{} {}" -t'.format(binary, map_width, map_height)
    for bot_command in bot_commands:
        game_run_command += " \"{}\"".format(bot_command)
    return subprocess.check_output(game_run_command, shell=True).decode()


def play_games(binary, map_width, map_height, bot_commands, number_of_runs):
    """
    Runs number_of_runs games using the designated bots and binary, recording the tally of wins per player
    :param binary: The Halite binary.
    :param map_width: The map width
    :param map_height: The map height
    :param bot_commands: The commands to run each of the bots (must be either 2 or 4)
    :param number_of_runs: How many runs total
    :return: Nothing
    """
    print("Comparing Bots!")
    result = {}
    if not(len(bot_commands) == 4 or len(bot_commands) == 2):
        raise IndexError("The number of bots specified must be either 2 or 4.")
    for current_run in range(0, number_of_runs):
        match_output = _play_game(binary, map_width, map_height, bot_commands)
        winner = _determine_winner(match_output)
        result[winner] = result.setdefault(winner, 0) + 1

        significant = False
        for index1, bot1 in enumerate(result.values()):
            for index2, bot2 in enumerate(result.values()):
                if index1 != index2:
                    if _statistical_significance(current_run + 1, bot1, bot2):
                        significant = True
                        break

        print("run {}: wins{}{}".format(current_run + 1, result, " significant!" if significant else ""))
