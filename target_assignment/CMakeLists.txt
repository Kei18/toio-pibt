cmake_minimum_required(VERSION 3.16)
project(target_assignment CXX)

file(GLOB SRCS "./src/*.cpp")
add_executable(ta ./src/main.cpp ${SRCS})
target_compile_features(ta PUBLIC cxx_std_17)
target_link_libraries(ta PRIVATE ${YAML_CPP_LIBRARIES})

add_subdirectory(../third_party/yaml-cpp ./yaml-cpp)
target_link_libraries(ta yaml-cpp)