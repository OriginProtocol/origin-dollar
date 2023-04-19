import { Store } from "pullstate";

interface IRouteStore {
  prevRoute: string | null;
}

const RouteStore = new Store<IRouteStore>({
  prevRoute: null,
});

export default RouteStore;
