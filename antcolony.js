var AntColony = (function (undefined) {
    "use strict";

    function AntColony (parameters) {
        this.parameters = parameters;
        // {
        //     nodesCount
        //     nodesCountSource
        //     maxHops
        //     num_of_ants
        //     a // heuristicRate
        //     b // statisticalRate
        //     k // pheromoneBias
        //     r // evaporation rate
        // }

        this.allnodes = getNumberRange(parameters.nodesCount);

        var maxHops = parameters.maxHops;
        if (!maxHops || maxHops > parameters.nodesCount) {
            parameters.maxHops = parameters.nodesCount;
        }

        if (!parameters.nodesCountSource) {
            parameters.nodesCountSource = parameters.nodesCount;
        }

        this.pheromoneMatrix = new Array(parameters.nodesCountSource);
        for (var i = 0; i < parameters.nodesCountSource; i++) {
            this.pheromoneMatrix[i] = new Array(parameters.nodesCount);
            for (var j = 0; j < parameters.nodesCount; j++) {
                this.pheromoneMatrix[i][j] = 0;
            }
        }

        this.bestPath = {
            nodes: [],
            score: 0,
            unchangedIterations: 0
        };


        var that = this;
        this.getpheromone = function  (x, y) {
            if (that.symetric && y < x) {
                return that.pheromoneMatrix[y][x];
            } else {
                return that.pheromoneMatrix[x][y];
            }
        };

        this.setpheromone = function  (x, y, value) {
            if (that.symetric && y < x) {
                that.pheromoneMatrix[y][x] = value;
            } else {
                that.pheromoneMatrix[x][y] = value;
            }
        };
    }

    function getNumberRange (num) {
        var result = [];
        for (var i = 0; i < num; i++) {
            result.push(i);
        }
        return result;
    }

    AntColony.prototype.iterate = function () {
        var chosenpaths = [];
        var chosenpaths_scores = [];

        var params = {};
        for (var param in this.parameters) {
            params[param] = this.parameters[param];
        }
        params.getpheromone = this.getpheromone;
        params.setpheromone = this.setpheromone;

        // map phase => release the ants
        for (var ant_i = 0, ant_count = this.parameters.num_of_ants; ant_i < ant_count; ant_i++) {
            var ant = new Ant(this.allnodes, params);
            ant.run();

            chosenpaths.push({
                nodes: ant.visited,
                score: ant.current_score
            });
        }

        // reduce phase 1 => evaporate pheromone
        this.evaporatePheromone();

        // reduce phase 2 => deploy pheromone on paths
        this.applyPheromone(chosenpaths);
    };

    AntColony.prototype.evaporatePheromone = function () {
        var r = this.parameters.r;

        for (var i = 0, i_len = this.pheromoneMatrix.length; i < i_len; i++) {
            var row = this.pheromoneMatrix[i];
            for (var j = 0, j_len = row.length; j < j_len; j++) {
                if (i !== j) {
                    var score = this.getpheromone(i, j);
                    if (score) {
                        this.setpheromone(i, j, score * (1-r));
                    }
                }
            }
        }
    };

    AntColony.prototype.applyPheromone = function (chosenpaths) {
        this.bestPath.unchangedIterations++;

        for (var i = 0, i_len = chosenpaths.length; i < i_len; i++) {
            var currentPath = chosenpaths[i];
            var currentPathNodes = currentPath.nodes;

            var pheromoneDeposit = currentPath.score / this.parameters.maxHops;

            for (var j = 1, j_len = currentPathNodes.length; j < j_len; j++) {
                var startNode = currentPathNodes[j-1];
                var endNode = currentPathNodes[j];

                this.setpheromone(startNode, endNode, this.getpheromone(startNode, endNode) + pheromoneDeposit);
            }

            if (currentPath.score > this.bestPath.score) {
                this.bestPath.nodes = currentPath.nodes;
                this.bestPath.score = currentPath.score;
                this.bestPath.unchangedIterations = 0;
            }
        }
    };

    function Ant (availableNodes, params) {
        this.init(availableNodes, params);
    }

    Ant.prototype.init = function ant_init (availableNodes, params) {
        this.params = params;

        // choose a random start point
        var randomStartNode = (Math.random() * availableNodes.length) | 0;
        this.visited = [randomStartNode];

        // copy the array
        this.notvisited = availableNodes.slice();
        // remove the starting point
        this.notvisited.splice(availableNodes.indexOf(randomStartNode), 1);
        this.current_score = 0;
    };

    Ant.prototype.run = function ant_run () {
        for (var i = 0, len = this.params.maxHops; i < len; i++) {
            var currentNode = this.visited[this.visited.length - 1];
            this.step(currentNode);
        }
    };

    Ant.prototype.step = function ant_run (currentNode) {
        var selected_move = this.get_next_move(currentNode);
        this.current_score += getscores(currentNode, selected_move);

        this.visited.push(selected_move);
        this.notvisited.splice(this.notvisited.indexOf(selected_move), 1);
        return selected_move;
    };

    Ant.prototype.get_next_move = function ant_next_move (currentNode, notvisited, params) {
        if (currentNode === undefined) {
            currentNode = this.visited[this.visited.length - 1];
        }
        if (notvisited === undefined) {
            notvisited = this.notvisited;
        }
        if (params === undefined) {
            params = this.params;
        }

        var a = params.a; // heuristicRate
        var b = params.b; // statisticalRate
        var k = params.k; // pheromoneBias

        var heuristics = [];
        var hsum = 0;
        for (var i = notvisited.length - 1; i >= 0; i--) {
            var target = notvisited[i];
            
            var heuristic = Math.pow(k + params.getpheromone(currentNode, target), a) *
                            Math.pow(getscores(currentNode, target), b);

            hsum += heuristic;
            heuristics.push(heuristic);
        }

        var choice = getrandomchoice(heuristics, hsum);
        // should never occur, but just in case
        if (choice === undefined) {
            return notvisited[notvisited.length - 1];
        }
        return choice;
    };

    function getrandomchoice (heuristics, hsum) {
        if (hsum === undefined) {
            hsum = heuristics.reduce(function (a, b) { return a + b; });
        }
        
        var randomChoice = Math.random() * hsum;

        for (var i = heuristics.length - 1; i >= 0; i--) {
            randomChoice -= heuristics[i];
            if (randomChoice <= 0) {
                return i;
            }
        }
        return undefined;
    }

    return AntColony;
})();
