import { Route, Routes } from "react-router-dom";
import NotFound from "../../pages/NotFound";
import Dashboard from "./Dashboard";
import { Branch, EcetHome, Explore, Learn, Papers, Results, TestList, Topics } from "./Ecet";
import { Practice, ResultView, SelfTest, TakeTest } from "./Quiz";
import { Career, Comm, JobPrep } from "./Learn";
import { Applications, JobDetail, Jobs } from "./Jobs";
import Curriculum from "./Curriculum";
import Profile from "./Profile";

export default function StudentApp() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="ecet" element={<EcetHome />} />
      <Route path="ecet/curriculum" element={<Curriculum />} />
      <Route path="ecet/explore" element={<Explore />} />
      <Route path="ecet/branch" element={<Branch />} />
      <Route path="ecet/learn/:id" element={<Learn />} />
      <Route path="ecet/topics/:subject" element={<Topics />} />
      <Route path="ecet/practice" element={<Practice />} />
      <Route path="ecet/mock" element={<SelfTest kind="mock" />} />
      <Route path="ecet/cumulative" element={<SelfTest kind="cumulative" />} />
      <Route path="ecet/papers" element={<Papers />} />
      <Route path="ecet/tests/:type" element={<TestList />} />
      <Route path="ecet/results" element={<Results />} />
      <Route path="test/:id" element={<TakeTest />} />
      <Route path="result/:id" element={<ResultView />} />
      <Route path="job-prep" element={<JobPrep />} />
      <Route path="job-prep/:sec" element={<JobPrep />} />
      <Route path="career" element={<Career />} />
      <Route path="career/:sec" element={<Career />} />
      <Route path="communication" element={<Comm />} />
      <Route path="communication/:sec" element={<Comm />} />
      <Route path="jobs" element={<Jobs />} />
      <Route path="jobs/saved" element={<Jobs savedOnly />} />
      <Route path="jobs/:id" element={<JobDetail />} />
      <Route path="applications" element={<Applications />} />
      <Route path="profile/*" element={<Profile role="student" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
