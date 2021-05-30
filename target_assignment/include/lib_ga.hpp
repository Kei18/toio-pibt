#pragma once
#include <functional>
#include <vector>
#include <cmath>


struct Node;
using Nodes = std::vector<Node*>;

struct Node {
  const int id;
  const float x;
  const float y;
  Nodes neighbor;

  Node(int _id, float _x, float _y) : id(_id), x(_x), y(_y) {}

  float h_dist(const Node* const node) const
  {
    float dx = x - node->x;
    float dy = y - node->y;
    return std::sqrt(dx * dx + dy * dy);
  }
};


namespace LibGA
{
  struct FieldEdge;
  struct FlowNode;
  using FlowNodes = std::vector<FlowNode*>;

  // pair of start and goal
  struct FieldEdge {
    int start_index;
    int goal_index;
    Node* s;  // start
    Node* g;  // goal

    bool evaled;  // whether real distance is computed or not
    float inst_d;   // instance distance
    float d;        // real distance

    FieldEdge(int sindex, int gindex, Node* _s, Node* _g, float _d);
    FieldEdge(int sindex, int gindex, Node* _s, Node* _g, float _d1, float _d2);

    void setRealDist(float _d);
  };

  struct Matching {
    const Nodes starts;
    const Nodes goals;
    const int N;                         // number of starts
    static constexpr int NIL = -1;       // mean empty
    std::vector<std::vector<int>> adj;   // edges
    std::vector<int> mate;               // pair
    std::vector<std::vector<float>> cost;  // start -> goal
    int matched_num;
    Nodes assigned_goals;  // results

    Matching(const Nodes& _goals);

    void addEdge(FieldEdge const* e);
    void resetCurrentMate();
    void mariage(const int s, const int g);
    float getCost();

    // find one augmenting path
    void updateByIncrementalFordFulkerson(FieldEdge const* e);

    // successive shortest path algorithm
    void solveBySuccessiveShortestPath();

    // simple error handling
    void halt(const std::string& msg);
  };
};  // namespace LibGA
