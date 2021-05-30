#pragma once
#include <queue>
#include <tuple>

#include "lib_ga.hpp"

class GoalAllocator
{
private:
  const Nodes starts;
  const Nodes goals;

  Nodes assigned_goals;  // assignment

  float matching_cost;  // estimation of sum of costs
  float matching_makespan;  // estimation of makspan

  // lazy evaluation
  using DijkstraNode = std::tuple<Node*, float>;  // node, g
  using DijkstraNodes = std::vector<DijkstraNode>;
  static bool compareDijkstraNodes(DijkstraNode a, DijkstraNode b);
  using DijkstraQueue = std::priority_queue<DijkstraNode, DijkstraNodes,
                                           std::function<bool(DijkstraNode, DijkstraNode)>>;
  std::vector<DijkstraQueue> OPEN_LAZY;
  std::vector<std::vector<float>> DIST_LAZY;
  float getLazyEval(const int i, Node* const g);

  static constexpr int NIL = -1;

public:
  GoalAllocator(const Nodes& _starts, const Nodes& _goals, const int _nodes_num);
  ~GoalAllocator();

  // solve the problem
  void assign();

  // get results
  Nodes getAssignedGoals() const;
  float getMakespan() const;
  float getCost() const;
};
