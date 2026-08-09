declare module '*.css';
declare module '*.less';
declare module '*.png';

declare namespace API {
  type CurrentUser = {
    access?: string;
    avatar?: string;
    email?: string;
    name?: string;
    phone?: string;
    permissions?: string[];
    roles?: string[];
    userid?: string;
  };
}
