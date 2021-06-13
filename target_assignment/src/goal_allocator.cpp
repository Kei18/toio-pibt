#include "../include/goal_allocator.hpp"
#include <iostream>

std::function<bool(GoalAllocator::DijkstraNode, GoalAllocator::DijkstraNode)> GoalAllocator::dcompare =
  [] (DijkstraNode a, DijkstraNode b)
  {
    if (std::get<1>(a) != std::get<1>(b)) return std::get<1>(a) > std::get<1>(b);
    return std::get<0>(a)->id > std::get<0>(b)->id;
  };


GoalAllocator::GoalAllocator(const Nodes& _starts, const Nodes& _goals, const int nodes_num)
  : starts(_starts),
    goals(_goals),
    matching_cost(0),
    matching_makespan(0),
    DIST_LAZY((int)starts.size(), std::vector<float>(nodes_num, NIL))
{
  for (int i = 0; i < (int)starts.size(); ++i) {
    auto Q = new std::priority_queue<DijkstraNode, DijkstraNodes, decltype(dcompare)>(dcompare);
    OPEN_LAZY.push_back(Q);
  }
}

GoalAllocator::~GoalAllocator() {
  for (auto Q : OPEN_LAZY) delete Q;
}

void GoalAllocator::assign()
{
  const int num_agents = goals.size();

  auto matching = LibGA::Matching(goals);

  // use priority queue & lazy evaluation

  // setup priority queue
  auto compare = [](const LibGA::FieldEdge& a, const LibGA::FieldEdge& b) {
    if (a.evaled && b.evaled) {
      if (a.d != b.d) return a.d > b.d;
    } else if (!a.evaled && !b.evaled) {
      if (a.inst_d != b.inst_d) return a.inst_d > b.inst_d;
    } else if (a.evaled && !b.evaled) {
      if (a.d != b.inst_d) return a.d > b.inst_d;
    } else if (!a.evaled && b.evaled) {
      if (a.inst_d != b.d) return a.inst_d > b.d;
    }
    // tie break
    if (a.start_index != b.start_index) return a.start_index < b.start_index;
    return a.g->id < b.g->id;
  };

  // setup open list
  std::priority_queue<LibGA::FieldEdge, std::vector<LibGA::FieldEdge>, decltype(compare)>
    OPEN(compare);

  for (int i = 0; i < num_agents; ++i) {
    auto s = starts[i];
    // lazy evaluation
    for (int j = 0; j < num_agents; ++j) {
      auto g = goals[j];
      OPEN.emplace(i, j, s, g, s->h_dist(g));
    }
  }

  while (!OPEN.empty()) {
    auto p = OPEN.top();
    OPEN.pop();

    // lazy evaluation
    if (!p.evaled) {
      p.setRealDist(getLazyEval(p.start_index, p.g));
      OPEN.push(p);
      continue;
    }

    if (matching_makespan > 0) {  // add equal cost edges
      if (p.d <= matching_makespan) {
        matching.addEdge(&p);
        continue;
      } else {
        break;  // end
      }

    } else {
      // update matching
      matching.updateByIncrementalFordFulkerson(&p);
    }

    // perfect match
    if (matching.matched_num == num_agents) matching_makespan = p.d;
  }

  // use min cost maximum matching
  matching.solveBySuccessiveShortestPath();

  assigned_goals = matching.assigned_goals;
  matching_cost = matching.getCost();
}

float GoalAllocator::getLazyEval(const int i, Node* const g)
{
  // already evaluated
  if (DIST_LAZY[i][g->id] != NIL) return DIST_LAZY[i][g->id];

  // initialize
  if (OPEN_LAZY[i]->empty()) {
    OPEN_LAZY[i]->push(std::make_tuple(starts[i], 0));
  }

  // Dijkstra
  while (!OPEN_LAZY[i]->empty()) {
    auto n = OPEN_LAZY[i]->top();
    auto d_n = std::get<1>(n);
    auto v_n = std::get<0>(n);

    // pop
    OPEN_LAZY[i]->pop();

    // already searched
    if (DIST_LAZY[i][v_n->id] >= 0) continue;

    // update closed list
    DIST_LAZY[i][v_n->id] = d_n;

    // expand neighbors
    for (auto m : v_n->neighbor) {
      auto d_m_new = d_n + v_n->h_dist(m);
      auto d_m_old = DIST_LAZY[i][m->id];  // closed
      if (d_m_old >= 0 && d_m_old <= d_m_new) continue;
      OPEN_LAZY[i]->push(std::make_tuple(m, d_m_new));
    }

    // check goal condition
    if (v_n == g) return d_n;
  }

  // failure
  std::cout << "unreachable node"
            << ", agent:" << i
            << ", from:" << starts[i]->id
            << ", to:" << g->id << std::endl;
  std::exit(1);
  return NIL;
}


Nodes GoalAllocator::getAssignedGoals() const { return assigned_goals; }

float GoalAllocator::getCost() const { return matching_cost; }

float GoalAllocator::getMakespan() const { return matching_makespan; }
