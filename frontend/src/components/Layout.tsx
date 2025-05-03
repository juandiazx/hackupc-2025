import React from 'react';
import Menu from './Menu';
import { Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
    return (
        <>
            <Outlet />
            <Menu />
        </>
    );
};

export default Layout;