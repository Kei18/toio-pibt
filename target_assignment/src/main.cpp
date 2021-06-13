#include <iostream>
#include "../include/lib_ga.hpp"
#include "../include/goal_allocator.hpp"
#include "yaml-cpp/yaml.h"
#include <fstream>
#include <unordered_map>
#include <string>


int main(int argc, char *argv[])
{
  if (argc != 4) {
    std::cout << "invalid call\n"
              << "> ta {filename_graph} {filename_problem} {filename_output}"
              << std::endl;
    return 1;
  }

  auto filename_graph = argv[1];
  auto filename_problem = argv[2];
  auto filename_output = argv[3];

  std::unordered_map<int, Node*> V;

  // load graph
  int nodes_num = 0;
  YAML::Node config_V = YAML::LoadFile(filename_graph);
  for (auto itr = config_V.begin(); itr != config_V.end(); ++itr) {
    auto id = itr->first.as<int>();
    auto x = itr->second["pos"]["x"].as<float>();
    auto y = itr->second["pos"]["y"].as<float>();
    auto v = new Node((int)id, x, y);
    V[id] = v;
    nodes_num = std::max(id, nodes_num);
  }

  // set adjacency
  for (auto itr = config_V.begin(); itr != config_V.end(); ++itr) {
    auto id = itr->first.as<int>();
    for (auto u : itr->second["neigh"]) {
      V[id]->neighbor.push_back(V[u.as<int>()]);
    }
  }

  Nodes starts;
  Nodes goals;
  std::vector<std::string> agent_names;

  YAML::Node config_P = YAML::LoadFile(filename_problem);
  for (auto itr = config_P.begin(); itr != config_P.end(); ++itr) {
    agent_names.push_back(itr->first.as<std::string>());
    starts.push_back(V[itr->second["v"].as<int>()]);
    goals.push_back(V[itr->second["g"].as<int>()]);
  }

  auto ga = GoalAllocator(starts, goals, nodes_num);
  ga.assign();

  std::cout << "makespan=" << ga.getMakespan() << ", costs=" << ga.getCost() << std::endl;

  auto assigned_goals = ga.getAssignedGoals();
  for (int i = 0; i < (int)starts.size(); ++i) {
    auto s = starts[i];
    auto g = assigned_goals[i];
    std::cout << s->id << " (x=" << s->x << ", y=" << s->y << ") -> "
              << g->id << " (x=" << g->x << ", y=" << g->y << ")" << std::endl;
  }

  // create yaml file
  std::ofstream log;
  log.open(filename_output, std::ios::out);
  for (int i = 0; i < (int)agent_names.size(); ++i) {
    log << agent_names[i] << ":\n"
        << "  v: '" << starts[i]->id << "'\n"
        << "  g: '" << assigned_goals[i]->id  << "'\n";
  }
  log.close();

  // clear
  for (auto itr = V.begin(); itr != V.end(); ++itr) delete itr->second;
  return 0;
}
