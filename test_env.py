from meowlympics_env import MeowlympicsEnv

env = MeowlympicsEnv()
obs, _ = env.reset()
print("obs shape:", obs.shape)   # should be (10,)

obs, reward, done, _, _ = env.step(0)
print("step ok, reward:", reward)