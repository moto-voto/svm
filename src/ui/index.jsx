import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import SearchPage from './pages/SearchPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import BookmarksPage from './pages/BookmarksPage.jsx';
import PlayerPage from './pages/PlayerPage.jsx';
import SeriesDetailsPage from './pages/SeriesDetailsPage.jsx';
import './styles.css';
import { BASE_PATH } from "./utils.js";

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

render(
    () => (
        <Router base={BASE_PATH} scrollRestoration>
            <Route path="/" component={SearchPage} />
            <Route path="/history" component={HistoryPage} />
            <Route path="/bookmarks" component={BookmarksPage} />
            <Route path="/series" component={PlayerPage} />
            <Route path="/series-details" component={SeriesDetailsPage} />
            <Route path="*" component={() => <Navigate href="/" />} />
        </Router>
    ),
    root
);
