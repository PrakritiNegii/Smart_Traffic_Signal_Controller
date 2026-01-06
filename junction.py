class Junction:
    def __init__(self, lane_counts):
        """
        lane_counts = {
            "N": int,
            "S": int,
            "E": int,
            "W": int
        }
        """
        self.lane_counts = lane_counts

        # Fixed 4-phase order (realistic rotation)
        self.phases = ["P1", "P2", "P3", "P4"]

        # Phase → lane mapping
        self.phase_lanes = {
            "P1": ["N"],
            "P2": ["S"],
            "P3": ["E"],
            "P4": ["W"]
        }

        # Memory to prevent starvation
        self.last_phase = None

    def get_phase_loads(self):
        """
        Returns vehicle count per phase
        """
        phase_loads = {}

        for phase in self.phases:
            lanes = self.phase_lanes[phase]
            phase_loads[phase] = sum(
                self.lane_counts[lane] for lane in lanes
            )

        return phase_loads

    def select_phase(self):
        """
        Anti-starvation phase selection:
        - Prefer highest load
        - Prevent same phase repeating forever
        """
        phase_loads = self.get_phase_loads()

        # Phase with maximum traffic
        max_phase = max(phase_loads, key=phase_loads.get)

        # First cycle → no history
        if self.last_phase is None:
            self.last_phase = max_phase
            return max_phase

        # If same phase would repeat, rotate
        if max_phase == self.last_phase:
            idx = self.phases.index(self.last_phase)
            next_phase = self.phases[(idx + 1) % len(self.phases)]
            self.last_phase = next_phase
            return next_phase

        # Otherwise, choose busiest
        self.last_phase = max_phase
        return max_phase

    def get_phase_lane_counts(self, phase):
        """
        Returns lane-wise counts for selected phase
        """
        return {
            lane: self.lane_counts[lane]
            for lane in self.phase_lanes[phase]
        }
